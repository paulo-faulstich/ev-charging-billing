from datetime import UTC, datetime, tzinfo
from decimal import Decimal

import pytest

from app.modules.ingestion.domain.errors import InvalidSession
from app.modules.ingestion.domain.session import (
    IdentityConfidence,
    SessionCandidate,
    SourceKind,
)


class NullOffset(tzinfo):
    def utcoffset(self, dt: datetime | None):
        return None


def test_session_candidate_builds_stable_deduplication_key() -> None:
    values = {
        "source": SourceKind.SEMS_EXPORT,
        "external_id": None,
        "charger_serial": "STN00DEMO0000001",
        "started_at": datetime(2026, 8, 29, 17, 10, tzinfo=UTC),
        "ended_at": datetime(2026, 8, 29, 18, 10, tzinfo=UTC),
        "energy_kwh": Decimal("7.00"),
        "charge_port": 1,
        "card_id_raw": "STN00DEMO0000001",
    }

    first = SessionCandidate.create(**values)
    second = SessionCandidate.create(**values)

    assert first.deduplication_key == second.deduplication_key
    assert first.deduplication_key == (
        "13e37b659731ee1c76e7766d2f347e017a5220165e2b53f766007cd637164e95"
    )
    assert first.identity_confidence is IdentityConfidence.UNKNOWN


@pytest.mark.parametrize(
    ("energy", "end_hour", "field", "code"),
    [
        (Decimal(0), 18, "energy_kwh", "ENERGY_NOT_POSITIVE"),
        (Decimal(7), 16, "ended_at", "END_NOT_AFTER_START"),
    ],
)
def test_session_candidate_rejects_invalid_measurements(
    energy: Decimal,
    end_hour: int,
    field: str,
    code: str,
) -> None:
    with pytest.raises(InvalidSession) as error:
        SessionCandidate.create(
            source=SourceKind.SEMS_EXPORT,
            external_id=None,
            charger_serial="STN00DEMO0000001",
            started_at=datetime(2026, 8, 29, 17, tzinfo=UTC),
            ended_at=datetime(2026, 8, 29, end_hour, tzinfo=UTC),
            energy_kwh=energy,
            charge_port=1,
            card_id_raw=None,
        )

    assert (error.value.field, error.value.code) == (field, code)


@pytest.mark.parametrize("field", ["started_at", "ended_at"])
def test_session_candidate_rejects_tzinfo_without_offset(field: str) -> None:
    started_at = datetime(2026, 8, 29, 17, tzinfo=UTC)
    ended_at = datetime(2026, 8, 29, 18, tzinfo=UTC)
    if field == "started_at":
        started_at = started_at.replace(tzinfo=NullOffset())
    else:
        ended_at = ended_at.replace(tzinfo=NullOffset())

    with pytest.raises(InvalidSession) as error:
        SessionCandidate.create(
            source=SourceKind.SEMS_EXPORT,
            external_id=None,
            charger_serial="STN00DEMO0000001",
            started_at=started_at,
            ended_at=ended_at,
            energy_kwh=Decimal(7),
            charge_port=1,
            card_id_raw=None,
        )

    assert (error.value.field, error.value.code) == (field, "TIMEZONE_REQUIRED")
