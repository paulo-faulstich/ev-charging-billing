# EV ChargeOps - Problem Frame

**Status:** consolidated proposal for review

**Date:** 29 August 2026

## 1. Context

Residential and corporate buildings share electrical infrastructure, parking spots and
chargers among people with different usage patterns. The charger records energy and times,
but those records do not automatically become assignment per unit, allocation, billing or
operational guidance.

In the challenge where this project started, the vendor portal (SEMS+) showed real data from
a GoodWe charger, but the EV Charger API was not made available to participants and the
reference model does not offer OCPP. The equipment was in operation and could not receive
commands or configuration changes.

## 2. Problem statement

Building managers and users of shared charging infrastructure have no integrated, auditable
way to assign sessions to units, compute individual consumption, apply allocation rules and
follow the billing. The data exists in SEMS+, but it is not connected to the building's
context and was not available through an API.

## 3. Available evidence

> Updated on 31 August 2026, after the full history was captured. The earlier version of this
> section described a 30-day window and stated that the `Card ID` was equal to the station
> serial. Both points are corrected below, and the conclusion about identity became stronger,
> not weaker.
>
> The observations in this section come from the real reference charger. The raw captures
> and the equipment identifiers are not part of this repository; the files under
> [`../../data/charger-export/`](../../data/charger-export/) are synthetic and reproduce the
> same format and the same defects.

### 3.1 Where the per-session data actually lives

The per-session history is not on any station screen. It is on the device: **Station Details
→ EV Charger → `Charging Record` panel**, which has its own date-range filter and export.

That matters because the station screens are a dead end for this product:

- `Energy Monitoring` shows series **for the plant**, and the `Charged Energy` series there
  is the **stationary battery**, not the charger. On a day when the charger delivered
  10.50 kWh, that series showed about 0.5 kWh.
- `EV Charger Monitoring` shows the charger's **daily** energy — useful for order of
  magnitude and reconciliation, useless for billing, because it has no start time and so
  cannot resolve the tariff band.
- The **Report Center** exports only station and inverter reports. The two formats tested
  (`Station Statistical Report` and `Station Operation Report`) contain no sessions at all.

### 3.2 What the history contains

The history captured covers eight months, and its total matches the header of the report
itself. Each row carries `Card ID`, `RFID Card Name`, start, end, duration and energy
charged.

The volume is stable: between 10 and 26 sessions per month, with 130 to 178 kWh per month
once usage settled.

### 3.3 The identity field exists and identifies no one

This is the product's central evidence, and it is more specific than first assumed:

- The `Card ID` is **the same value in every session**, across eight months. It does not
  vary with the user, the day or the vehicle.
- That value is the **`EV Charger SN` declared in the header of the report itself**: the
  field that looks like identity is the equipment serial. (The serial cited in the earlier
  documentation belongs to the station, not the charger.)
- The **`RFID Card Name` column exists and is empty** on every row.

The equipment **supports** identification: the HCA G2 has an RFID reader, and the report
reserves two columns for the cardholder. What was missing on site was the card registry —
and, even where it exists, nothing in the vendor's data links a card to a unit or to a
charge. That bridge is the product.

### 3.4 Raw data quality

A few sessions in the history are connections with no energy delivered (0.00 kWh), some of
them with start and end at the same instant. Ingestion rejects them with
`ENERGY_NOT_POSITIVE` and `END_NOT_AFTER_START`, keeping the raw record. These are real
defects of the vendor's portal, not of the conversion.

### 3.5 Access limitations

- A broad query of roughly 13 months returned no data on the energy screen, while the
  default 30-day window worked. The `Charging Record`, on the other hand, accepted eight
  months at once. Ingestion still validates batch by batch.
- The challenge organizers confirmed that the EV Charger API would not be released to
  participants, that the flow is query-based (`pull`) and that the access offered was to the
  plant in SEMS+.

## 4. Users and needs

### Building manager

When closing the charging period, needs to turn operational data into charges people can
understand, locate inconsistencies and explain the allocation without handling fragile
spreadsheets.

### Resident or charger user

When receiving a charge, needs to recognize the sessions assigned to their unit and
understand energy, tariff, shared costs and payment status.

### Technical operator

When an import or a session has an error, needs to identify source, batch, raw record and
the transformation applied, to fix the problem without silently changing history.

## 5. Current state and workarounds

The manager checks SEMS+, exports or transcribes records and manually adds the information
the portal does not have, mainly user and unit. That process provides no deduplication, no
audit trail, no consistent application of the allocation and no explicit separation between
real and demonstration data.

## 6. Impacts of the problem

- Operational time to consolidate sessions and close the period.
- Risk of a session being duplicated, omitted or assigned to the wrong unit.
- Difficulty defending the allocation when it is disputed.
- No visibility into anomalies, peak-demand hours and consumption trend.
- Low portability: the process depends on one vendor's interface and format.

## 7. Product hypothesis

If EV ChargeOps normalizes sessions from different sources into a canonical model, preserves
the provenance of every field and applies deterministic rules for assignment, tariff and
allocation, then the manager will be able to close auditable charges and the resident will be
able to understand their own consumption, even when the original integration is limited.

## 8. Desired outcomes

1. Turn charging records into auditable canonical sessions.
2. Increase the coverage of sessions correctly assigned to units.
3. Reduce effort and uncertainty in the monthly closing.
4. Produce deterministic, explainable invoices.
5. Flag inconsistencies before billing.
6. Allow the current CSV source to evolve into APIs or future protocols without rewriting
   the domain.

## 9. Constraints

- No command or configuration is sent to the charger.
- The solution does not depend on GoodWe API credentials that were not provided.
- The HCA G2 is not presented as OCPP equipment.
- Real and simulated fields are identified separately.
- The ANEEL tariff is presented as a base estimate, with source and reference date.
- Mercado Pago would be used only in a sandbox environment. (Payments were later removed
  from the scope; see the [PRD](prd.md).)

## 10. Product principles

- **Auditable by default:** every relevant value points to its source and calculation rule.
- **Truth before automation:** limitations of the source are exposed, not masked.
- **Replaceable vendor:** external sources come in through stable contracts.
- **Explainable AI:** insights show the data and rules that support the conclusion.
- **Least privilege:** the demonstration is read-only with respect to real equipment.
- **Incremental evolution:** modular monolith first; split into services only when there is
  a proven need.

## 11. Non-goals

- Remotely controlling power, start or end of charging sessions.
- Automating the SEMS+ web interface as a permanent source.
- Processing real payments.
- Presenting simulated data as real telemetry.
- Building a public charging network or a full reservation system.
- Training complex models on the small history available.

## 12. Assumptions and validation

| Assumption | How it is validated |
|---|---|
| The history can be obtained as a structured file | Import a file exported from SEMS+; while the format is unavailable, use a fixture faithful to the observed fields |
| Monthly windows are enough for the closing | Demonstrate import, deduplication and closing of a monthly period |
| Sessions without identity can be handled without faking certainty | Require explicit assignment and record `identityConfidence` |
| The public tariff can support a transparent estimate | Store the source, validity and components used in the calculation |
| A transactional integration strengthens product validation | Create and follow a Pix charge in sandbox only (deferred; see the [PRD](prd.md)) |

## 13. Relation to the original proposal

This problem frame does not replace the research behind the original proposal. It turns that
research, and the constraints discovered afterwards, into an operational definition for the
next stage.
