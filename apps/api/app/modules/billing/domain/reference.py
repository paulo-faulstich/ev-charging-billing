"""Reference tariff and policy from the original proposal.

These values are the implementation contract for the apportionment model. They
are kept in the domain, rather than in a fixture, because the demo seed and the
golden test must use the very same numbers the the original proposal worked example was
computed with.

Band windows were derived from the eight sessions of `data/reference-example/sessions.csv`
and their `tariff_band` labels, and reproduce every one of them from the
session start time alone. the original proposal applied peak pricing on weekends too, so the
windows carry no weekday distinction.
"""

from .policy import BillingPolicy
from .tariff import TariffBand, TariffSnapshot, TariffWindow

REFERENCE_TIMEZONE = "America/Sao_Paulo"

PEAK = "peak"
MID = "mid"
OFF_PEAK = "off_peak"


def reference_tariff() -> TariffSnapshot:
    return TariffSnapshot(
        # The numbers are the the original proposal contract; the name is what a resident
        # reads on their own invoice, and "the proposal" means nothing to them.
        name="Building tariff 2026",
        timezone=REFERENCE_TIMEZONE,
        bands=(
            TariffBand(
                code=PEAK,
                rate_cents_per_kwh=125,
                windows=(TariffWindow(18 * 60, 21 * 60),),
            ),
            TariffBand(
                code=MID,
                rate_cents_per_kwh=95,
                windows=(TariffWindow(6 * 60, 18 * 60),),
            ),
            TariffBand(
                code=OFF_PEAK,
                rate_cents_per_kwh=78,
                windows=(
                    TariffWindow(0, 6 * 60),
                    TariffWindow(21 * 60, 24 * 60),
                ),
            ),
        ),
    )


def reference_policy() -> BillingPolicy:
    return BillingPolicy(
        name="Standard building allocation",
        infra_fee_cents=2_500,
        loss_basis_points=400,
    )
