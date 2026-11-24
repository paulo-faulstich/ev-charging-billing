"""Seed the condominium-side registry: residents and one RFID card.

This is the half of the data the charger cannot know. The equipment measures
energy and authenticates a card; it has no idea that unit A-101 exists, who
lives there, or who pays. A condominium administration knows exactly that, and
in production it comes from their own records.

Everything written here is scenario, and deliberately so: the units and
residents are fictional. The charging sessions come from a separate file in the
charger's export format and carry their own provenance on every session. The
two never merge silently.

The registered card is fictional on purpose. The only card id the charger
export reports is `EVC7K0DEMO000001`, which is the charger's own serial:
registering that as if it belonged to a resident would state something false.
It is left unregistered, which is why the imported sessions reach the review
queue.

Usage:
    apps/api/.venv/bin/python apps/api/scripts/seed_condominium_registry.py
"""

import asyncio
import sys
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid5

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.organizations.infrastructure.models import (
    ChargerModel,
    MembershipModel,
    ProfileModel,
    SiteModel,
    UnitModel,
)
from app.modules.sessions.infrastructure.models import (
    ChargingCardModel,
)
from app.shared.config import get_settings
from app.shared.database import (
    create_engine_from_settings,
    create_session_factory,
)
from scripts.seed_demo_scenario import ensure_tariff_and_policy
from scripts.seed_operational_foundation import (
    DEMO_ORGANIZATION_ID,
)

NAMESPACE = UUID("6f1d2a4c-9c3e-4f0b-8a5e-2b7c1d4e9f30")

RESIDENTS = (
    ("A-101", "Ana Souza", "ana.souza@example.test"),
    ("A-102", "Bruno Lima", "bruno.lima@example.test"),
    ("A-103", "Carla Mendes", "carla.mendes@example.test"),
    ("A-104", "Diego Ferreira", "diego.ferreira@example.test"),
    ("LJ-01", "Padaria do Largo", "contato@padariadolargo.example.test"),
)

# A card the condominium would issue. Not the charger's serial: that number
# identifies equipment, and calling it a resident's card would be a lie the
# invoice would then repeat.
DEMONSTRATION_CARD = ("A-101", "RFID-A101-0001", "Ana Souza's card")

# The serial the SEMS+ charging report declares in its header. The value the
# foundation seed carries (STN00DEMO0000001) belongs to the station, not to the
# EV charger, so a real export would find no equipment to attach to.
CHARGER_SERIAL = "EVC7K0DEMO000001"


async def seed_registry(session: AsyncSession) -> dict[str, int]:
    units = {
        unit.code: unit
        for unit in (
            await session.execute(
                select(UnitModel).where(
                    UnitModel.organization_id == DEMO_ORGANIZATION_ID
                )
            )
        )
        .scalars()
        .all()
    }
    if not units:
        raise SystemExit(
            "No unit found. Run seed_operational_foundation first."
        )

    manager = (
        await session.execute(
            select(ProfileModel)
            .join(
                MembershipModel, MembershipModel.profile_id == ProfileModel.id
            )
            .where(
                MembershipModel.organization_id == DEMO_ORGANIZATION_ID,
                MembershipModel.role == "manager",
            )
            .limit(1)
        )
    ).scalar_one()

    # Tariff and policy are condominium decisions, taken in assembly and
    # applied by the administration: they belong with the registry, not with a
    # month of charges.
    await ensure_tariff_and_policy(session)

    charger_id = uuid5(NAMESPACE, f"charger-{CHARGER_SERIAL}")
    created_chargers = 0
    if await session.get(ChargerModel, charger_id) is None:
        site = (
            await session.execute(
                select(SiteModel)
                .where(SiteModel.organization_id == DEMO_ORGANIZATION_ID)
                .limit(1)
            )
        ).scalar_one()
        session.add(
            ChargerModel(
                id=charger_id,
                organization_id=DEMO_ORGANIZATION_ID,
                site_id=site.id,
                serial=CHARGER_SERIAL,
                name="GoodWe HCA G2 (garage)",
                nominal_power_kw=Decimal("7.500"),
            )
        )
        created_chargers += 1

    created_residents = 0
    for code, name, email in RESIDENTS:
        unit = units.get(code)
        if unit is None:
            continue
        profile_id = uuid5(NAMESPACE, f"resident-{code}")
        if await session.get(ProfileModel, profile_id) is None:
            session.add(
                ProfileModel(
                    id=profile_id,
                    auth_user_id=uuid5(NAMESPACE, f"auth-{code}"),
                    email=email,
                    display_name=name,
                )
            )
            await session.flush()
        membership_id = uuid5(NAMESPACE, f"membership-{code}")
        if await session.get(MembershipModel, membership_id) is None:
            session.add(
                MembershipModel(
                    id=membership_id,
                    organization_id=DEMO_ORGANIZATION_ID,
                    profile_id=profile_id,
                    unit_id=unit.id,
                    role="resident",
                )
            )
            created_residents += 1

    created_cards = 0
    unit_code, card_id, label = DEMONSTRATION_CARD
    unit = units.get(unit_code)
    if unit is not None:
        card_pk = uuid5(NAMESPACE, f"card-{card_id}")
        if await session.get(ChargingCardModel, card_pk) is None:
            session.add(
                ChargingCardModel(
                    id=card_pk,
                    organization_id=DEMO_ORGANIZATION_ID,
                    card_id=card_id,
                    unit_id=unit.id,
                    label=label,
                    registered_by=manager.id,
                )
            )
            created_cards += 1

    await session.commit()
    return {
        "residents": created_residents,
        "cards": created_cards,
        "chargers": created_chargers,
    }


async def main() -> None:
    settings = get_settings()
    engine = create_engine_from_settings(settings)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            counts = await seed_registry(session)
    finally:
        await engine.dispose()

    print("Building registry")
    print(f"  residents linked ....... {counts['residents']}")
    print(f"  cards registered ....... {counts['cards']}")
    print(f"  charger ................ {counts['chargers']}")
    print()
    print(f"The charger's own card id ({CHARGER_SERIAL}) is NOT registered:")
    print("it is the equipment's serial, not anyone's identity.")


if __name__ == "__main__":
    asyncio.run(main())
