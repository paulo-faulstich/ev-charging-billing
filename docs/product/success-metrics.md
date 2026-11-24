# EV ChargeOps - Success Metrics

**Version:** 0.2

**Status:** approved for implementation

**Date:** 30 August 2026

**PRD:** [prd.md](prd.md)

## 0. What changed in version 0.2

Alignment with the invoice-first cut of [PRD 0.4](prd.md). The payment, forecasting and
segmentation metrics were marked as deferred, with no change to their content, to keep
traceability with the original proposal. New metrics came in for reconciliation against the
vendor's aggregate, immutability of the issued invoice, PDF generation, reproduction of the
original worked example and isolation of the resident context.

## 1. Measurement principle

The metrics separate prototype success from future operational results. The MVP targets
validate system behavior; they do not yet represent proven commercial impact.

## 2. North Star Metric

### Auditable Session Coverage

Percentage of the period's valid sessions that have recorded provenance, validated
consumption, a usable assignment and traceable inclusion in an invoice.

```text
Auditable Session Coverage =
  billed sessions with valid provenance + assignment
  --------------------------------------------------- × 100
             valid sessions imported
```

A session excluded because of an error stays in the denominator until it is corrected or
formally discarded with a justification.

## 3. Outcome metrics

| Metric | Definition | Desired direction |
|---|---|---|
| Assignment coverage | Valid sessions linked to a unit / valid sessions | Increase |
| Unassigned consumption | Valid kWh without a unit / valid kWh imported | Decrease |
| Closing time | Time between the start of the review and issuing the invoices | Decrease |
| Internal reconciliation | Absolute difference between eligible kWh and billed kWh | Approach zero |
| External reconciliation | Absolute difference between billed kWh and the charger aggregate for the period | Approach zero, or be explained |
| Dispute rate | Invoices disputed / invoices issued | Decrease |
| Resolution time | Median time between an analytical finding and a recorded decision | Decrease |

Impact metrics will be baselined only after use by real managers. The prototype instruments
the events needed to measure them.

## 4. MVP acceptance metrics

| ID | Metric | MVP target | Evidence |
|---|---|---|---|
| M-01 | Ingestion coverage of the SEMS+ fixture | 100% of records classified as valid, invalid or duplicate | Batch result |
| M-02 | Duplication on re-import | 0 new sessions when re-importing the same batch | Idempotency test |
| M-03 | Provenance coverage | 100% of persisted sessions with source, batch and raw record | Audit query |
| M-04 | Allocation determinism | 100% of re-runs identical for the same snapshot | Domain test |
| M-05 | Internal reconciliation | Difference of 0.00 kWh between eligible sessions and billed items | Closing report |
| M-06 | Identity transparency | 100% of sessions with confidence `confirmed`, `assigned` or `unknown` | Session query |
| M-07 | Detection of prepared cases | 100% of known anomalous fixtures flagged with an explanation | Rule test |
| M-08 | Organizational isolation | 0 cross-organization access in the authorization tests | Security test |
| M-09 | Tariff integration | One versioned tariff with bands, source, validity and capture demonstrated | Tariff record |
| M-10 | Payment integration | **Deferred to P1.** Metric preserved unchanged | — |
| M-11 | Provenance in the interface | 100% of session and invoice screens identify real, assigned and simulated data | E2E test |
| M-12 | Equipment safety | 0 commands or changes sent to the charger | Integration review |
| M-13 | Demonstrable forecasting | **Deferred to P1.** Metric preserved unchanged | — |
| M-14 | Reproducible segmentation | **Deferred to P1.** Metric preserved unchanged | — |
| M-15 | AI traceability | 100% of results presented have an algorithm version and a dataset reference | Audit query |
| M-16 | Comparison with the original worked example | Energy and losses preserved per unit; equal totals for single-user units; explicit reduction of R$ 25.00 for U102 from the single fee. Includes the three exceptional cases | Golden tests and the justification in section 4.4 of the PRD |
| M-17 | External reconciliation | The difference between billed energy and the charger aggregate is computed and shown at closing, never absorbed silently | Closing report |
| M-18 | Invoice immutability | Changing tariff or policy after issuing does not change any amount on an invoice already issued | Domain test |
| M-19 | Explicit approval | 0 invoices issued without an approval action recorded with actor and instant | Audit query |
| M-20 | PDF generation | An issued invoice produces a downloadable PDF whose composition matches the one on screen | E2E test |
| M-21 | Resident-context isolation | The resident context returns no data from another unit, and access goes through the same authorization resolver as a real resident | Authorization test |
| M-22 | Impersonation audit | 100% of accesses in resident context produce an audit event with actor, unit and instant | Audit query |

## 5. Guardrail metrics

- Zero secrets versioned in Git.
- Zero simulated sessions presented as real.
- Zero vendor aggregate values presented as a billable session.
- Zero remote modification of the charger.
- Zero invoices issued for an unreviewed critical session.
- Zero invoices issued without explicit approval.
- Zero resident-context access to another unit's data.
- Zero writes from a resident context.

## 6. Product events

| Event | Minimum properties |
|---|---|
| `import_started` | organizationId, source, batchId, timestamp |
| `import_completed` | batchId, validCount, invalidCount, duplicateCount |
| `aggregate_imported` | batchId, source, periodFrom, periodTo, dayCount |
| `session_assigned` | sessionId, previousConfidence, newConfidence, actorId |
| `anomaly_flagged` | sessionId, ruleCode, severity |
| `closing_opinion_generated` | periodId, insightRunId, severity, confidence, blockingCount |
| `billing_period_closed` | periodId, sessionCount, energyKwh, invoiceCount, actorId |
| `invoice_issued` | invoiceId, unitId, amountCents, sessionCount |
| `invoice_pdf_downloaded` | invoiceId, actorId, context |
| `resident_context_entered` | actorId, unitId, timestamp |

Events do not store name, email or sensitive payloads.

## 7. Claims and evidence

| Claim | Measurable evidence |
|---|---|
| Working architecture | A batch traceable from the input to the invoice and the PDF |
| Data management and structure | M-01 to M-06, M-16 and M-17 |
| Role of the analysis | M-07 and M-15, with the opinion acting before the invoice and blocking issuing |
| Fit to the context | M-11, M-12, M-17 and sessions in the real SEMS+ export format |
| A real product view | M-09, M-18 to M-22 and instrumented outcome metrics |

## 8. Future cadence

- Batch metrics: on every import.
- Closing metrics: monthly.
- Review of anomaly rules: after each confirmed false positive or false negative.
- Review of commercial targets: after the first cycle with a real baseline.
