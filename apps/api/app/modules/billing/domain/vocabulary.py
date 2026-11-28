"""How the invoice names a tariff band to the person paying it.

A band's `code` is its identity: it is persisted on every invoice item, cited by
the golden test and compared across closes, so it never changes. What a resident
reads is a different thing, and it lives here — once, because the screen and the
PDF must call the same band by the same name.

The names are a table rather than a slug transformation because `off_peak`
does not humanise into a good label on its own. When tariffs become editable
per condominium, this becomes a column on the band; until then an unknown code
falls back to a readable form of itself instead of disappearing.
"""

from .tariff import MINUTES_IN_DAY, TariffBand

BAND_LABELS = {
    "peak": "Peak",
    "mid": "Mid-peak",
    "off_peak": "Off-peak",
}


def band_label(code: str) -> str:
    """The band's name in words. Never empty, whatever the code turns out to be."""
    known = BAND_LABELS.get(code)
    if known is not None:
        return known
    spoken = code.replace("_", " ").strip()
    return spoken[:1].upper() + spoken[1:] if spoken else code


def _clock(minute_of_day: int) -> str:
    hour, minute = divmod(minute_of_day % MINUTES_IN_DAY, 60)
    return f"{hour % 12 or 12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"


def band_hours(band: TariffBand) -> str:
    """When the band applies, read as a clock rather than as minutes.

    A night band is stored as two windows because windows never wrap past
    midnight, but nobody reads their own night as "0h to 6h and 21h to 24h".
    Those two are rejoined into the single stretch they always were.
    """
    windows = sorted(band.windows, key=lambda window: window.start_minute)
    if not windows:
        return ""
    spans = [(window.start_minute, window.end_minute) for window in windows]
    if len(spans) > 1 and spans[0][0] == 0 and spans[-1][1] == MINUTES_IN_DAY:
        wrapped = (spans[-1][0], spans[0][1])
        spans = [wrapped, *spans[1:-1]]
    return " and ".join(f"{_clock(start)} to {_clock(end)}" for start, end in spans)


# Where a tariff came from. The stored value is a classifier, kept short and
# stable for auditing; this is the sentence a resident reads instead of it.
TARIFF_SOURCE_LABELS = {
    "manual": "Set by the building's management",
    "aneel": "Utility tariff table (ANEEL)",
    "reference_table": "Reference table",
}


def tariff_source_label(source: str) -> str:
    return TARIFF_SOURCE_LABELS.get(source, source)
