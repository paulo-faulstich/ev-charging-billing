# EV ChargeOps

**When a building shares one EV charger, someone has to turn the charger's export into a bill
per apartment that residents will accept.** EV ChargeOps does that: it imports the charging
sessions, attributes each one to a unit, applies versioned tariffs and cost-sharing rules,
blocks the monthly closing when the data does not hold up, and issues an invoice per unit that
can be traced back to the source records.

> **Status:** working prototype, runnable locally. Not production software. It started as an
> entry in an industry challenge run by GoodWe with FIAP and is now maintained as a personal
> project. All data in this repository is synthetic: the charging sessions follow the format
> of a real charger export, and the building, units, residents, cards and tariffs are a
> demonstration scenario.

![Overview of a closed month: energy, assigned sessions, daily consumption and the closing opinion](docs/screenshots/dashboard.png)

Walkthrough of the interface, recorded on the synthetic July 2026 scenario:

https://github.com/user-attachments/assets/9efad8cd-f240-4b23-9c74-4e3eec6d2d44

## The problem

Shared chargers in residential buildings create a billing problem, not a charging problem. The
charger knows how much energy each session used. It does not know who used it, which tariff
applied, how fixed costs and losses should be split, or whether last month's numbers add up.
Building managers end up doing this in a spreadsheet, and residents have no way to check the
result.

The hard parts are the ones a spreadsheet hides:

- **Identity.** When no resident cards are issued, the export's card field just repeats the
  charger's serial number. It does not identify anyone.
- **Reconciliation.** Session totals and the charger's own aggregate do not always match.
- **Trust.** A resident disputing a bill needs to see which sessions produced it and under
  which rules.

## What it does

```text
CSV exported from the charger portal (SEMS+)
  → validation and import, with provenance
  → attribution by registered card or by a justified manager decision
  → versioned tariff and cost-sharing policy
  → closing opinion and review of findings
  → closing approval
  → invoice per unit, with an auditable PDF
```

- **Import.** Line-by-line preview, rejection of invalid records, the raw record kept as
  received, and protection against duplicates on re-import.
- **Attribution.** A registered card assigns the session to a unit. An unknown identity goes
  to a queue for a justified decision. The charger's serial is never accepted as a resident card.
- **Allocation.** Energy by tariff band, a fixed fee per active unit, and losses proportional
  to the energy value. Rounding is per session and amounts are stored in cents.
- **Analysis before issuing.** Integrity rules plus statistical outlier detection run before
  any invoice exists. Unresolved critical findings block the closing.
- **Invoices.** Rules are frozen at issue time, the composition can be verified, and every
  line links back to its source record.
- **Reconciliation.** The difference against the charger's aggregate is shown to the manager
  and is never silently spread across residents.

The invoice explains itself: the total, its three components, every session behind it, and
what the same energy would have cost in a cheaper time band.

![Invoice for one unit: total, breakdown and the sessions that produced it](docs/screenshots/invoice.png)

## What it showed

Reproducing July 2026 from a clean database with the synthetic export and the demonstration
scenario:

| Check | Result |
|---|---|
| Records in the monthly file | 22, of which 21 valid |
| Energy billed | 204.29 kWh |
| Invoices | 4, one per active unit |
| Total | $331.63 |

| Unit | Energy | Total |
|---|---:|---:|
| A-101 | 115.030 kWh | $155.03 |
| A-102 | 46.120 kWh | $84.96 |
| A-103 | 23.630 kWh | $50.81 |
| A-104 | 19.510 kWh | $40.83 |

Importing the full history afterwards added 132 valid sessions, recognized the 21 already
imported and rejected four invalid ones. The full file has 157 records and 1,590.40 kWh.

Automated checks: 328 Python tests on the backend (319 unit, 9 integration) and 44 browser
tests on the interface, all passing, plus lint and type checks.

## What the analysis is, and is not

The closing opinion (`closing-opinion/1.0.0`) combines deterministic rules (invalid interval,
non-positive energy, incompatible power, overlap, session without a unit) with outlier
detection using a modified z-score over the median and the MAD. With fewer than five sessions
for a unit, it reports an insufficient sample instead of guessing.

Critical findings block issuing until a decision is recorded. A statistical deviation produces
a warning for review. The financial engine stays deterministic.

**No language model generates the opinion, and there is no trained forecasting or
segmentation model.** Forecasting and clustering were part of the original proposal and were
deferred: a charger export does not identify users, and demonstration assignments cannot
support real predictions or resident profiles.

## Scope decisions

| Planned | Built | Why |
|---|---|---|
| Vendor API integration, OCPP as an alternative | CSV import with validation and provenance | API access for EV chargers was not available, and the reference charger did not expose OCPP |
| RFID identity per user | Registered cards or a justified manual assignment | The card field in the export repeats the charger's serial |
| Invoice and fixed fee per user | Invoice and fixed fee per unit | The unit is the stable party responsible for payment |
| Forecasting and clustering | Deferred | The data does not identify users |
| Automated tariff lookup | Versioned tariffs with source and validity | Demonstration values, labeled as a scenario |
| Payments (Pix) | Out of scope | The prototype produces the document for the building to charge |
| Resident portal with its own login | A restricted, audited per-unit view opened by the manager | Shows isolation without building resident onboarding |

## Stack

Next.js and TypeScript for the interface, FastAPI and Python for the backend, SQLite for the
local demo, and Supabase adapters (PostgreSQL, Auth, Storage) for a remote mode. An OpenAPI
contract is shared with the frontend through a generated TypeScript client.

Architecture decisions are recorded as ADRs in [`docs/decisions/`](docs/decisions/):

- [0003: ports and adapters for replaceable integrations](docs/decisions/0003-ports-and-adapters.md)
- [0004: explicit provenance for real, assigned and simulated data](docs/decisions/0004-data-provenance.md)
- [0005: Next.js and FastAPI as a modular monolith](docs/decisions/0005-nextjs-fastapi-modular-monolith.md)

## Run it locally

Requirements: Node.js `>=22.13.0 <23`, pnpm `11.19.0`, and Python 3.12+ with `uv`. Local mode
needs no external account. Run from the repository root.

```bash
pnpm install
uv sync --project apps/api
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:upgrade
uv run --project apps/api python apps/api/scripts/seed_operational_foundation.py
```

Start the API in one terminal:

```bash
pnpm dev:api
```

In another terminal, provision the local manager, register the scenario and reproduce July:

```bash
curl --fail --silent --output /dev/null \
  -H 'Authorization: Bearer fixture-manager-token' \
  http://127.0.0.1:8407/v1/me
uv run --project apps/api python apps/api/scripts/seed_condominium_registry.py
uv run --project apps/api python apps/api/scripts/seed_demo_july.py
```

On a new database the expected result is 21 valid sessions, 204.29 kWh, four invoices and
$331.63. Then start the interface:

```bash
AUTH_MODE=fixture pnpm dev:web
```

Open `http://localhost:3407`. Fixture authentication signs in the local manager automatically
and is only allowed in development and test.

| Route | What to look at |
|---|---|
| `/dashboard` | Consumption and operational overview |
| `/settings/data-sources` | Import preview and per-line errors |
| `/sessions` | Sessions, provenance and justified attribution |
| `/charging-cards` | Cards linked to units |
| `/closing` | July 2026, the opinion and the closing |
| `/invoices` | The four July invoices and their PDFs |

## Verify

```bash
pnpm --dir apps/web exec playwright install chromium --with-deps
AUTH_MODE=supabase pnpm check
```

`AUTH_MODE=supabase` is needed because the production build refuses fixture authentication.
The browser tests set their own fixture mode and a disposable database.

## Repository layout

```text
apps/api/               API, domain, persistence, migrations and Python tests
apps/web/               Next.js interface and browser tests
packages/api-client/    OpenAPI contract and TypeScript client
data/charger-export/    Synthetic charger exports, in the vendor's export format
data/reference-example/ Simulated worked example used by the golden test
docs/product/           Problem frame, PRD and success metrics
docs/technical/         Technical specification
docs/decisions/         Architecture decision records
```

## Limitations

- No live integration with the charger vendor. Data arrives as an exported file.
- No payments, no resident login, no commands sent to the charger.
- Card registration is implemented but was not validated with real cards.
- Tariffs and unit assignments are a scenario. A real deployment needs a validated registry,
  the contracted tariff, and invoices checked against the utility bill.
- Local mode demonstrates the prototype. It does not prove production operation.

See also: [use of AI tools in development](docs/ai-usage.md).

---

Built by [Paulo Faulstich](https://github.com/paulo-faulstich) · 2026 · [MIT License](LICENSE)
