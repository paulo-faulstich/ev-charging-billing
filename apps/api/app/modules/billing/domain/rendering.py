"""What the invoice document says, independent of how it is drawn.

The renderer receives the persisted invoice and this context, and must not
touch the database or recompute any figure: the stored integers are the only
source. `invoice_document_lines` is the pure, testable statement of the
document's content; the PDF is a typeset view of exactly these lines.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol
from zoneinfo import ZoneInfo

from .invoice import InvoiceView
from .vocabulary import band_label, tariff_source_label


@dataclass(frozen=True, slots=True)
class InvoiceDocumentContext:
    organization_name: str
    site_name: str
    timezone: str
    tariff_name: str
    tariff_source: str
    tariff_source_reference: str | None
    tariff_valid_from: date
    tariff_valid_to: date | None
    policy_name: str
    infra_fee_cents: int
    loss_basis_points: int
    provenances: tuple[str, ...]


class InvoiceRenderer(Protocol):
    def render(
        self, invoice: InvoiceView, context: InvoiceDocumentContext
    ) -> bytes: ...


def format_brl(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    reais, rest = divmod(abs(cents), 100)
    grouped = f"{reais:,}".replace(",", ".")
    return f"{sign}R$ {grouped},{rest:02d}"


def format_kwh(value: Decimal) -> str:
    return f"{value:.3f}".replace(".", ",") + " kWh"


def format_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _local(value: datetime, timezone: str) -> datetime:
    return value.astimezone(ZoneInfo(timezone))


def _percent(basis_points: int) -> str:
    return f"{basis_points / 100:.2f}%".replace(".", ",")


def _duration(start: datetime, end: datetime) -> str:
    minutes = int((end - start).total_seconds() // 60)
    hours, rest = divmod(minutes, 60)
    return f"{hours}h{rest:02d}"


PROVENANCE_LABELS = {
    "real": "real data",
    "simulated": "simulated data",
}


def provenance_label(provenances: tuple[str, ...]) -> str:
    if not provenances:
        return "no sessions in the period"
    labels = [
        PROVENANCE_LABELS.get(provenance, provenance)
        for provenance in sorted(set(provenances))
    ]
    return ", ".join(labels)


def invoice_document_lines(
    invoice: InvoiceView, context: InvoiceDocumentContext
) -> tuple[str, ...]:
    """Every statement the document makes, in reading order.

    The four blocks mirror the invoice page of the design (section 9), minus
    the advice block, which is derived guidance for the screen rather than a
    fact of the bill.
    """
    timezone = context.timezone
    lines: list[str] = [
        f"Invoice {invoice.number}",
        f"{context.organization_name} - {context.site_name}",
        f"Unit {invoice.unit_code} ({invoice.unit_name})",
        f"Responsible: {invoice.contact_label}",
        f"Period: {invoice.period_value}",
        f"Issued on {format_date(_local(invoice.issued_at, timezone).date())}",
        "",
        "How much and why",
        f"Energy: {format_brl(invoice.energy_value_cents)}",
        f"Infrastructure fee: {format_brl(invoice.infra_fee_cents)}",
        f"Technical losses: {format_brl(invoice.loss_share_cents)}",
        f"Total: {format_brl(invoice.total_cents)}",
        "",
        "Where it came from",
    ]
    if invoice.items:
        lines.append(
            f"{len(invoice.items)} session(s), {format_kwh(invoice.energy_kwh)}"
        )
        for item in invoice.items:
            start = _local(item.started_at, timezone)
            end = _local(item.ended_at, timezone)
            lines.append(
                f"{start.strftime('%d/%m/%Y %H:%M')} to {end.strftime('%H:%M')}"
                f" ({_duration(item.started_at, item.ended_at)}), "
                f"{format_kwh(item.energy_kwh)}, {band_label(item.band_code)}, "
                f"{item.rate_cents_per_kwh} cents/kWh: "
                f"{format_brl(item.value_cents)}"
            )
    else:
        lines.append("No sessions in the period. No consumption, nothing is charged.")
    validity_end = (
        format_date(context.tariff_valid_to)
        if context.tariff_valid_to is not None
        else "in effect"
    )
    lines.extend(
        [
            "",
            "Why this tariff",
            (
                f"Tariff: {context.tariff_name} "
                f"(source: {tariff_source_label(context.tariff_source)})"
            ),
            f"Validity: {format_date(context.tariff_valid_from)} to {validity_end}",
            (
                f"Allocation policy: {context.policy_name} "
                f"(fee {format_brl(context.infra_fee_cents)} per active "
                f"unit, losses {_percent(context.loss_basis_points)})"
            ),
            "",
            f"Provenance: {provenance_label(context.provenances)}",
            (
                "Document generated from the invoice's stored values; "
                "no value is recomputed."
            ),
        ]
    )
    if context.tariff_source_reference:
        lines.append(f"Tariff reference: {context.tariff_source_reference}")
    return tuple(lines)
