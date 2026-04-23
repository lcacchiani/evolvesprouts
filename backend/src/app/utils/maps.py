"""Derive Google Maps directions URLs from venue data."""

from __future__ import annotations

from decimal import Decimal
from urllib.parse import quote_plus

_BASE = "https://www.google.com/maps/dir/?api=1&destination="


def _format_coord_component(value: Decimal) -> str:
    quantized = value.quantize(Decimal("0.000001"))
    text = format(quantized, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def build_google_maps_directions_url(
    *,
    address: str | None,
    lat: Decimal | None,
    lng: Decimal | None,
) -> str | None:
    """Return a Google Maps directions URL or None.

    Preference order:
    1. Coordinates when both lat and lng are present (precise pin).
    2. Non-empty address encoded with quote_plus (matches existing JSON format).
    3. None when nothing usable is available.
    """
    if lat is not None and lng is not None:
        pair = f"{_format_coord_component(lat)},{_format_coord_component(lng)}"
        return f"{_BASE}{quote_plus(pair)}"

    if address is not None:
        stripped = address.strip()
        if stripped:
            return f"{_BASE}{quote_plus(stripped)}"

    return None
