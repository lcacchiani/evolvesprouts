"""Geocode addresses via OpenStreetMap Nominatim (through AwsApiProxy)."""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from typing import Any
from urllib.parse import urlencode

from app.exceptions import AppError, ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.utils import require_env

_NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
# Comma-separated segment contains a floor marker ``/F`` (case-insensitive), e.g. ``G/F``, ``5/F``.
_FLOOR_SEGMENT = re.compile(r"/\s*[Ff]")


def _geocode_query_text(address: str) -> str:
    """Free-text query for the geocoder: drop segments through one with ``/F``."""
    raw = address.strip()
    if not raw:
        return ""
    parts = [p.strip() for p in raw.split(",")]
    parts = [p for p in parts if p]
    for i, part in enumerate(parts):
        if _FLOOR_SEGMENT.search(part):
            tail = ", ".join(parts[i + 1 :]).strip()
            return tail if tail else raw
    return raw


def _countrycodes_param(country_iso_codes: Sequence[str] | None) -> str | None:
    """Build ``countrycodes`` query value from DB-derived ISO codes."""
    if not country_iso_codes:
        return None
    seen: set[str] = set()
    ordered: list[str] = []
    for raw in country_iso_codes:
        if not raw:
            continue
        cc = str(raw).strip().lower()
        if len(cc) != 2 or not cc.isalpha() or cc in seen:
            continue
        seen.add(cc)
        ordered.append(cc)
    return ",".join(ordered) if ordered else None


def geocode_address_with_context(
    *,
    address: str,
    country_iso_codes: Sequence[str] | None = None,
) -> tuple[float, float, str | None]:
    """Return (lat, lng, display_name) for a free-text address.

    Args:
        address: Street or venue address. Comma-separated segments through the
            first that contains ``/F`` (case-insensitive), e.g. ``G/F`` or ``5/F``,
            are dropped from the geocoder query.
        country_iso_codes: Optional ISO 3166-1 alpha-2 values (e.g. from
            ``geographic_areas`` and ``sovereign_country_id``) for the
            ``countrycodes`` query parameter (comma-separated OR filter).

    Raises:
        ValidationError: When input is empty or the provider returns no results.
        AppError: On proxy failures, bad HTTP status, or invalid response payload.
    """
    q = _geocode_query_text(address)
    if not q:
        raise ValidationError("address is required", field="address")

    params: dict[str, str | int] = {
        "format": "json",
        "limit": 1,
        "q": q,
    }
    codes = _countrycodes_param(country_iso_codes)
    if codes:
        params["countrycodes"] = codes

    url = f"{_NOMINATIM_SEARCH}?{urlencode(params)}"
    user_agent = require_env("NOMINATIM_USER_AGENT").strip()
    referer = require_env("NOMINATIM_REFERER").strip()
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json",
        "Accept-Language": "en",
    }
    if referer:
        headers["Referer"] = referer

    try:
        raw = http_invoke("GET", url, headers=headers, timeout=15)
    except AwsProxyError as exc:
        raise AppError(
            "Geocoding service unavailable",
            status_code=502,
            detail=exc.message,
        ) from exc
    except RuntimeError as exc:
        raise AppError(
            "Geocoding is not configured",
            status_code=503,
            detail=str(exc),
        ) from exc

    status = int(raw.get("status", 0))
    body = raw.get("body")
    if not isinstance(body, str):
        raise AppError("Invalid geocoding response", status_code=502)
    if status != 200:
        raise AppError(
            "Geocoding provider returned an error",
            status_code=502,
            detail=f"HTTP {status}",
        )

    try:
        parsed: Any = json.loads(body)
    except json.JSONDecodeError as exc:
        raise AppError("Invalid geocoding response", status_code=502) from exc

    if not isinstance(parsed, list) or not parsed:
        raise ValidationError(
            "No geocoding results for this address",
            field="address",
        )

    first = parsed[0]
    if not isinstance(first, dict):
        raise AppError("Invalid geocoding response", status_code=502)

    lat_raw = first.get("lat")
    lon_raw = first.get("lon")
    if not isinstance(lat_raw, (str, int, float)) or not isinstance(
        lon_raw, (str, int, float)
    ):
        raise AppError("Invalid geocoding response", status_code=502)
    try:
        lat = float(lat_raw)
        lng = float(lon_raw)
    except (TypeError, ValueError) as exc:
        raise AppError("Invalid geocoding response", status_code=502) from exc

    if lat < -90 or lat > 90 or lng < -180 or lng > 180:
        raise AppError("Invalid coordinates from geocoding provider", status_code=502)

    display = first.get("display_name")
    display_name = display.strip() if isinstance(display, str) else None

    return lat, lng, display_name
