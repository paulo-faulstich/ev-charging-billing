# Charger export (synthetic)

These files are **synthetic**. They follow the column layout of the `Charging Record` export
from the GoodWe SEMS+ portal, but no row describes a real charger, building or person. They
exist so the import, attribution, closing and invoicing flow can be reproduced end to end.

| File | Contents |
|---|---|
| `2026-07-charging-sessions.csv` | July 2026: 22 records, 21 valid, 204.29 kWh |
| `2026-01-to-08-charging-sessions.csv` | January to August 2026: 157 records, 153 valid, 1,590.40 kWh |

## Format

```
Start Time,End Time,Charging Energy(kWh),Charging Port,Card ID,Device SN
02/07/2026 18:13:00,02/07/2026 21:30:00,6.93,1,EVC7K0DEMO000001,EVC7K0DEMO000001
```

Dates are `DD/MM/YYYY`, in the site's local time.

## What the data is built to show

- **The card field does not identify anyone.** `Card ID` equals `Device SN` on every row, which
  is what an export looks like when no resident cards have been issued. This is the gap the
  product closes: sessions arrive without an owner and have to be attributed.
- **Some rows must be rejected.** Four records carry zero energy, two of them with an end time
  equal to the start time. The importer refuses them (`ENERGY_NOT_POSITIVE`,
  `END_NOT_AFTER_START`) and keeps the raw record for audit.
- **Re-import is safe.** The July file is a subset of the full history. Importing both
  recognizes the 21 valid July sessions as already known.

## Rule for this folder

Files here are never edited after they are added. Corrections and normalization happen in the
ingestion adapter, not in the source file.

The generator is deterministic (fixed seed): slow single-phase charging at 2.1 to 2.7 kW,
mostly evening starts, one connector, no overlapping sessions.
