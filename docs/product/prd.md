# EV ChargeOps - Product Requirements Document

**Version:** 0.4

**Status:** approved for implementation

**Date:** 30 August 2026

**Problem frame:** [problem-frame.md](problem-frame.md)

**Success metrics:** [success-metrics.md](success-metrics.md)

**Tech spec:** [../technical/ev-chargeops-architecture.md](../technical/ev-chargeops-architecture.md)

## 0. What changed in version 0.4, and why

Version 0.3 planned tariff, allocation, anomaly detection, forecasting, segmentation and Pix
payment in the same increment. Six shallow capabilities do not hold up in a time-boxed
prototype; one complete, auditable path does.

This version cuts the scope to **invoice-first**: from telemetry to an explainable invoice,
end to end, with everything else pushed to P1.

| Change | Reason |
|---|---|
| Pix payment (Mercado Pago sandbox) leaves the scope | The challenge brief describes the charge as *a pass-through on the building's monthly fee*, not a one-off payment. The invoice is the deliverable; a payment gateway adds nothing to the building's problem |
| Forecasting and segmentation move to P1 | Both depend on history. Neither protects the integrity of the invoice, which is the axis of this cut |
| Anomaly detection becomes the closing opinion and stays in P0 | It is the only analytical capability that acts **before** the invoice and can block issuing. The analysis works as part of the product's logic, not as decoration |
| The allocation formula from the original proposal becomes the implementation contract | It was already specified with a worked example; energy and losses are preserved, and the divergence in the per-unit fee is documented in section 4.4. It replaces the `R$ 0.94/kWh` constant that was hardcoded in the frontend |
| The unit is the target of the assignment; the resident appears through the active link | The original proposal assumed identity by RFID. The field invalidated that premise: the reference charger has no cards configured, the `Card ID` repeats the equipment serial in **every session of the eight-month export**, the `RFID Card Name` column is empty, and the GoodWe OpenAPI exposes no identity field. The premise changed, not the plan |
| A registered card assigns on its own; the manager overrides when deciding | The equipment supports RFID and the report reserves columns for the cardholder. What does not exist in the vendor's data is the link between card, unit and billing. The card registry builds that bridge once, and automatic assignment then applies to every later session; `session_assignments.origin` keeps the two origins distinguishable for audit |
| The resident view is the invoice itself, reached by impersonation | One artifact serves both roles, with authorization as the filter. It avoids building two screens and avoids switching logins in the middle of a demo |
| The charger's energy aggregate comes in as a control total | It lets billed energy be reconciled against the vendor's own number, instead of comparing the import with itself |

The original proposal stands as written. What changed is what real access to SEMS+ and to the
OpenAPI documentation revealed after it.

## 1. Product vision

EV ChargeOps is an operations and intelligence layer for shared charging in residential and
corporate buildings. The platform turns heterogeneous charging records into auditable
sessions, assigns consumption to units, computes the allocation, detects anomalies and issues
explainable invoices, preserving the provenance of every piece of information.

## 2. Goal of this increment

Demonstrate a working vertical slice in which telemetry in the SEMS+ export format goes
through ingestion, normalization, assignment to a unit, a versioned tariff, allocation, an
explainable opinion, closing approval, an invoice per unit and an auditable PDF, with the
resident view reached from the same invoice.

```text
SEMS+ export or labeled demonstration scenario
  → auditable import
  → assignment to units
  → versioned tariff and allocation
  → explainable closing opinion
  → closing approval
  → invoice per unit
  → auditable PDF
  → resident view
```

## 3. Personas and permissions

### Manager (building manager)

- Imports batches and follows up on errors.
- Reviews sessions without identity and assigns them to units.
- Reviews the analytical opinion before issuing.
- Closes periods and issues invoices.
- Views the invoice as the resident sees it, through audited impersonation.
- Views consolidated metrics for the building.

### Resident

- Sees only their own unit, sessions and invoices.
- Checks the composition of the charge and the provenance of the data.
- Downloads the invoice as a PDF.

In the current increment there is no resident login. The role remains in the authorization
model and is exercised by the manager through impersonation, scoped to one unit and
read-only. Building a dedicated entry point for residents does not change the model.

### Technical operator

- Inspects batches, raw records, normalization failures and the audit trail.
- Does not change billed sessions without a recorded correction operation.

In the prototype, a single administrative account acts as both Manager and Technical
Operator. The separation of roles remains in the authorization model.

## 4. Functional scope

### 4.1 Organization and identity

- An organization represents the building or company.
- An organization has sites, chargers, units and users.
- The first demonstration has one active organization and one active site, but every
  operational entity is isolated by `organizationId`.
- Login is provided by Supabase Auth and authorization is enforced by FastAPI.
- The manager can assume a resident context restricted to one unit. That context uses the
  same authorization resolver and the same repository scope as a real resident, is read-only
  and produces an audit event.

### 4.2 Ingestion

Two distinct sources, with separate provenance and no silent mixing.

**Sessions (billable).** The manager selects the source and uploads a CSV file.

- The application shows a preview before persisting any session.
- Each import creates a batch with source, checksum, file name, time and result.
- Invalid records are rejected individually with a code, field and error message.
- Re-importing the same batch or the same session does not create duplicates.
- The raw record is preserved for audit.

**Charger aggregate (control total, not billable).** Energy per day as reported by the
equipment itself.

- No row of the aggregate becomes a session, is assigned to a unit or goes on an invoice.
- It exists only to reconcile billed energy against the vendor's number.
- The interface identifies the source on every screen where the value appears.

### 4.3 Sessions and assignment

- Source data is converted into a canonical model.
- Sessions may remain without a unit.
- The manager assigns a session to a unit, recording actor, date and justification.
- The interface distinguishes confirmed, assigned and unknown identity.
- Energy, times and source are not changed by the assignment.
- The raw `Card ID` is evidence, never confirmed identity.

### 4.4 Tariff and allocation

The model is the one defined in the original proposal, adopted here as the implementation
contract:

```text
invoice(unit, month) = individual_energy + infra_fee + loss_share

  individual_energy = Σ (session energy_kwh × tariff of its time band)
  infra_fee         = fixed amount charged once to each unit that
                      charged in the month
  loss_share        = percentage over individual_energy, proportional to consumption
```

- The system stores tariffs versioned by validity, source and capture date.
- The reference values from the original proposal are peak `R$ 1.25/kWh`, mid-peak
  `R$ 0.95/kWh` and off-peak `R$ 0.78/kWh`, an infrastructure fee of `R$ 25.00` per unit
  active in the month, and losses of `4%` over individual energy.
- The calculation identifies which tariff band applies to each session.
- Monetary values are computed and stored in integer cents.
- Re-running the calculation with the same data and the same rule version produces the same
  result.
- An issued invoice keeps an immutable snapshot of the rules and tariffs used.

Exceptional cases, as in the original proposal:

- **Interrupted session.** The energy actually delivered is billed; the session stays
  recorded with its status for audit.
- **Unit with no consumption in the month.** Zero invoice, no infrastructure fee. The policy
  is strictly pay-per-use.
- **Two vehicles in the same unit.** The sessions add up under the same unit, which is the
  durable target of the charge. When reliable per-vehicle identity exists, the detail can be
  displayed without changing who is financially responsible.

  **Recorded divergence from the original proposal.** The original proposal billed per RFID
  user, so unit U102, with two vehicles, paid the infrastructure fee twice (R$ 50.00). In the
  per-unit model it pays once (R$ 25.00). That unit's energy and losses reproduce exactly; the
  difference has one cause and one line. The reason is that field data cannot tell two
  vehicles apart — the reference charger has no cards configured and the GoodWe OpenAPI
  exposes no identity field — so billing per unit is the only rule the data supports, and the
  most defensible one in a residents' meeting. If a building wants to bill per vehicle, that
  becomes a `BillingPolicy` parameter once identity exists.

### 4.5 Period closing

- The period lists eligible and excluded sessions, with the reason.
- It shows assignment coverage and blocking pending items.
- It reconciles billed energy against eligible energy, with an expected difference of
  `0.00 kWh`, and against the charger aggregate for the same period.
- It requires explicit approval from the administrator.
- It creates an immutable snapshot of the policy and tariffs used.
- A session already billed does not move to another invoice through a silent edit.

### 4.6 Invoice and PDF

- The invoice belongs to one unit and one period.
- It contains the list of sessions, energy, the tariff applied per band, the infrastructure
  fee, losses and the total.
- It shows the resident or billing contact through the unit's active link.
- It shows data provenance, rule version and an auditable identifier.
- It can be generated and downloaded as a PDF with the product's visual identity.
- Later changes to tariff or rules do not change invoices already issued.

### 4.7 Insights and AI

**In scope for this increment — the closing opinion.**

- Deterministic rules identify invalid times, non-positive energy, average power incompatible
  with the equipment, duplicates and relevant deviations from the available history.
- Each finding carries a rule or algorithm, severity, evidence, explanation and confidence.
- The consolidated opinion presents a conclusion, severity, confidence, evidence and a
  recommendation.
- Insufficient data produces an explicitly inconclusive result, never artificial precision.
- Critical findings block the closing until a decision is recorded.
- The administrator keeps the final decision.

**Deferred to P1.** Consumption and demand forecasting, usage-profile segmentation and a
conversational interface. All three remain in the product plan and keep the requirements
already written (FR-14, FR-21 and FR-22), outside the current increment.

### 4.8 Experience

- The manager's dashboard shows energy, sessions, assignment coverage, pending items,
  reconciliation and closing progress for the selected period.
- The dashboard derives its numbers from the canonical session read model; raw charger
  identifiers do not represent residents or units.
- Pending items in the period open a filtered operational queue.
- After confirming an import, the manager gets an explicit handoff to continue the closing.
- The main navigation represents recurring destinations; import stays under
  `Settings > Data sources`.
- The invoice is a single page, serving both the manager's review and the resident view. The
  resident context is indicated by a permanent banner and is read-only.
- Every screen that combines real and demonstration data shows its provenance.
- The interface is in English. Currency, numeric dates and decimal separators keep the
  Brazilian format, because the scenario is a building in Brazil.

## 5. Main flow

1. The manager signs in and opens the site.
2. The manager imports a SEMS+ CSV or selects the labeled demonstration scenario.
3. The system validates, normalizes and deduplicates the batch.
4. The manager reviews the unidentified sessions and links them to units.
5. The system applies the versioned tariff in effect, identifying its reference.
6. The system presents the analytical opinion for the period, with evidence.
7. The manager resolves the blockers and approves the closing.
8. The system issues the invoices per unit and freezes the calculation snapshot.
9. The manager opens a unit's invoice as the resident sees it.
10. The invoice is downloaded as a PDF.

## 6. Functional requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FR-01 | Authenticate users | A valid token identifies user and organization; a missing or invalid token gets 401 |
| FR-02 | Authorize by role and organization | A user cannot reach another organization's data or actions outside their role |
| FR-03 | Create an import batch | An accepted file produces a batch with checksum, source and status |
| FR-04 | Preview the import | Before confirmation, shows counts of valid, invalid and duplicate records |
| FR-05 | Normalize a SEMS+ session | Observed fields are converted to the canonical model without losing the raw record |
| FR-06 | Guarantee idempotency | Re-importing does not create a second session for the same natural key |
| FR-07 | Explain a rejection | An invalid record shows a code, field and actionable reason |
| FR-08 | Assign a session | The manager links a session to a unit and the operation is audited |
| FR-09 | Expose identity confidence | Each session shows `confirmed`, `assigned` or `unknown` |
| FR-10 | Version the tariff | The tariff records values per band, validity, source and capture date |
| FR-11 | Compute the allocation | The invoice applies energy per band, infrastructure fee and losses under a versioned rule |
| FR-12 | Preserve the issued calculation | Later tariff changes do not change invoices already issued |
| FR-13 | Detect anomalies | Anomalous fixtures defined in the test plan produce explainable findings |
| FR-14 | Forecast consumption or demand | **Deferred to P1.** Requirement preserved unchanged |
| FR-15 | Create a sandbox Pix charge | **Deferred to P1.** Requirement preserved unchanged |
| FR-16 | Process an idempotent webhook | **Deferred to P1.** Requirement preserved unchanged |
| FR-17 | Show the manager dashboard | Metrics respect the selected organization, site and period |
| FR-18 | Show the resident view | The resident context sees only authorized units, sessions and invoices |
| FR-19 | Show provenance | Relevant fields identify a real, assigned, simulated, derived or external source |
| FR-20 | Export evidence | The manager exports a period summary with sessions, rules, invoices and sources |
| FR-21 | Segment usage profiles | **Deferred to P1.** Requirement preserved unchanged |
| FR-22 | Reproduce an AI run | Each run records algorithm, version, parameters, seed when applicable and an immutable dataset reference |
| FR-23 | Ingest the charger aggregate | Daily energy reported by the equipment is persisted with provenance and never becomes a billable session |
| FR-24 | Reconcile energy | The closing compares billed energy with eligible energy and with the charger aggregate, showing the differences |
| FR-25 | Approve the closing | A period only closes through an explicit administrator action and with blockers resolved |
| FR-26 | Freeze the snapshot | The closing records the tariff version, policy and parameters used, immutably |
| FR-27 | Issue an invoice per unit | The invoice shows unit, contact, sessions, energy, tariff per band, infrastructure, losses, total and an auditable identifier |
| FR-28 | Generate a PDF | An issued invoice produces a downloadable PDF with the same composition shown on screen |
| FR-29 | Present an explainable opinion | The opinion shows conclusion, severity, confidence, evidence and recommendation, or declares itself inconclusive |
| FR-30 | Assume a resident context | Impersonation is read-only, restricted to one unit, goes through the real authorization path and produces an audit event |
| FR-31 | Reproduce the original worked example | The engine preserves the energy and losses of `data/reference-example/invoices.csv`, reproduces the totals of single-user units and verifies the one-fee reduction for U102, as in section 4.4 |

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | TypeScript is used in the frontend and API client; Python is used in the backend and AI modules |
| NFR-02 | The domain does not import Supabase, ANEEL or GoodWe SDKs |
| NFR-03 | Every relevant write records actor, instant and organization |
| NFR-04 | Secrets exist only in environment variables or a secret manager |
| NFR-05 | Monetary values are stored in integer cents; energy, as a decimal with precision defined in the database |
| NFR-06 | Instants are stored in UTC and presented in the site's time zone |
| NFR-07 | Imports, calculations and closings are idempotent |
| NFR-08 | The API publishes an OpenAPI contract and structured errors |
| NFR-09 | Domain tests do not depend on the network or external services |
| NFR-10 | No flow sends commands to the charging equipment |
| NFR-11 | Analytical modules depend on canonical models and ports, not on GoodWe payloads, DataFrames or direct database access |
| NFR-12 | AI runs with stochastic components use a controlled seed in tests |
| NFR-13 | Monetary rounding is defined once in the domain and applied identically in calculation, display and PDF |

## 8. Out of scope

- GoodWe integration without official credentials.
- Permanent automation of the SEMS+ interface.
- Remote control, OCPP or Modbus.
- Payments, real or sandbox.
- A dedicated resident login.
- Parking-spot reservation and charging queues.
- Native mobile apps.
- Formal correction or reopening of closed periods.
- Training complex models or a separate AI service.

## 9. Risks and responses

| Risk | Product response |
|---|---|
| The real export format differs from the one observed | Isolate the parser in the adapter and keep a versioned fixture per format |
| Per-session history remains unavailable | The daily aggregate supports the chart, KPI and reconciliation; the labeled demonstration scenario supports the invoice, with explicit provenance |
| Identity comes neither from SEMS+ nor from the GoodWe API | Explicit manual assignment to the unit, with justification and confidence level |
| The public tariff does not reproduce the full utility bill | Label it as a base estimate and record components, source and validity |
| Reconciliation against the aggregate shows a difference | Show the difference as a blocker or warning, never absorb it silently into the invoice |
| A live demonstration fails | Keep a recorded capture of the full flow as a fallback |
| Scope grows toward controlling the charger | Keep remote control as a non-goal of this increment |

## 10. Definition of done for the demonstrable increment

- The main flow works end to end with real-format and demonstration data, each identified.
- Active acceptance criteria have an automated test or a traceable demonstration script.
  Deferred requirements stay documented and unimplemented.
- The allocation engine preserves the energy and losses of the original worked example and
  verifies the documented divergence of a single fee per unit.
- The calculation stays the same across re-runs over the same snapshot.
- Re-importing does not create duplicates.
- The sum of billed energy reconciles with eligible energy at `0.00 kWh`, and the difference
  against the charger aggregate is shown.
- The demonstration includes an explained analytical finding, an approved closing, an issued
  invoice, a downloaded PDF and the invoice seen in the resident context.
- README, PRD, metrics, Tech Spec and ADRs reflect the behavior delivered.
