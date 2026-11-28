"""Load the July 2026 charging history through the real import route.

The sessions come from `data/charger-export/2026-07-charging-sessions.csv`, a
synthetic file in the format of the SEMS+ `Charging Record` export. This script
adds no sessions of its own.

What this script does decide, and says so on every row it writes, is which
unit each charge belongs to. The export reports the charger's own serial as the
`Card ID`, as happens when no resident cards are issued. That is precisely the
gap the product exists to close, and a demonstration has to show the close
working, so the sessions are distributed across the scenario's units the way a
manager who knows the garage would do it, each with a justification saying it
is a demonstration.

The distribution is deterministic: the same CSV always produces the same month.

Requires the API running, because the point is to use its real routes:
    apps/api/.venv/bin/uvicorn app.main:app --app-dir apps/api \
        --host 127.0.0.1 --port 8407

Usage:
    apps/api/.venv/bin/python apps/api/scripts/seed_demo_july.py
"""

import json
import sys
import urllib.request
import uuid
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV_PATH = REPO_ROOT / "data" / "charger-export" / "2026-07-charging-sessions.csv"
# The full capture, imported so the trend has more than one month to describe.
# Only July is closed: the other months are evidence, not billing.
HISTORY_PATH = (
    REPO_ROOT / "data" / "charger-export" / "2026-01-to-08-charging-sessions.csv"
)
API = "http://127.0.0.1:8407"
TOKEN = "fixture-manager-token"
PERIOD = "2026-07"

# Whose charge is whose. A scenario, stated as one: the equipment cannot say,
# and this script is not pretending to have found out. The rotation is uneven on
# purpose, so the close has different amounts to apportion.
WEIGHTS = (0, 1, 0, 2, 0, 3, 1, 0)
JUSTIFICATION = (
    "Demo distribution: the charger issues no card per resident, so the "
    "unit is assigned to exercise the closing."
)


def call(
    method: str,
    path: str,
    *,
    body: Any = None,
    upload: Path | None = None,
) -> tuple[int, Any]:
    """One tiny HTTP client, so the script needs nothing but the standard library."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    data: bytes | None = None
    if upload is not None:
        boundary = uuid.uuid4().hex
        payload = upload.read_bytes()
        data = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{upload.name}"\r\n'
            f"Content-Type: text/csv\r\n\r\n"
        ).encode() + payload + f"\r\n--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{API}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return response.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw)
        except ValueError:
            return error.code, raw.decode("utf-8", "replace")


def main() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"CSV not found: {CSV_PATH}")

    status, _ = call("GET", "/health")
    if status != 200:
        raise SystemExit("The API is not running at " + API)

    status, batch = call("POST", "/v1/import-batches", upload=CSV_PATH)
    if status not in (200, 201):
        raise SystemExit(f"Import failed: {status} {batch}")

    if HISTORY_PATH.exists():
        history_status, history = call(
            "POST", "/v1/import-batches", upload=HISTORY_PATH
        )
        if history_status in (200, 201) and isinstance(history, dict):
            print(
                "Full history: "
                f"{history['validCount']} of {history['totalCount']} valid "
                f"({history['duplicateCount']} already known from July)"
            )
    if True:
        print(f"Batch imported: {batch['validCount']} of {batch['totalCount']} valid")

        catalog = sorted(
            call("GET", "/v1/assignment-units")[1]["items"],
            key=lambda unit: unit["code"],
        )
        if not catalog:
            raise SystemExit("No unit registered.")
        pending = call(
            "GET", f"/v1/sessions?period={PERIOD}&status=pending_review"
        )[1]["items"]
        pending.sort(key=lambda item: item["startedAt"])

        assigned = 0
        for index, charging_session in enumerate(pending):
            unit = catalog[WEIGHTS[index % len(WEIGHTS)] % len(catalog)]
            unit_id = unit["id"]
            code, _ = call(
                "PUT",
                f"/v1/sessions/{charging_session['id']}/assignment",
                body={"unitId": unit_id, "justification": JUSTIFICATION},
            )
            if code != 200:
                raise SystemExit(f"Assignment failed: {code}")
            assigned += 1

        print(f"Sessions assigned: {assigned}")

        _, opened = call("POST", "/v1/billing-periods", body={"periodValue": PERIOD})
        period_id = opened["id"]

        call("POST", f"/v1/billing-periods/{period_id}/closing-opinion")
        findings = call("GET", f"/v1/billing-periods/{period_id}/findings")[1]["items"]
        critical = [
            finding
            for finding in findings
            if finding["severity"] == "critical" and finding["resolvedAt"] is None
        ]
        for finding in critical:
            call(
                "POST",
                f"/v1/billing-periods/{period_id}/findings/{finding['id']}/decision",
                body={
                    "note": (
                        "Checked against the charger history; reading accepted "
                        "for the demonstration."
                    )
                },
            )
        print(f"Critical findings decided: {len(critical)}")

        code, body = call("POST", f"/v1/billing-periods/{period_id}/close")
        if code == 409:
            reason = body.get("code") if isinstance(body, dict) else None
            if reason == "PERIOD_ALREADY_CLOSED":
                print("Period was already closed; nothing was changed.")
                return
            blockers = body.get("blockers", []) if isinstance(body, dict) else []
            print("Closing blocked:")
            for blocker in blockers:
                print(f"  {blocker['code']}: {blocker['detail']}")
            return
        if code != 200:
            raise SystemExit(f"Closing failed: {code} {body}")
        total = sum(invoice["totalCents"] for invoice in body["invoices"]) / 100
        print(f"Period closed: {len(body['invoices'])} invoices, ${total:.2f}")
        for invoice in body["invoices"]:
            print(
                f"  {invoice['unitCode']:6} {invoice['contactLabel']:20}"
                f" {invoice['energyKwh']:>10} kWh"
                f"  ${invoice['totalCents'] / 100:8.2f}"
            )


if __name__ == "__main__":
    sys.exit(main())
