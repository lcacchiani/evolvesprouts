"""Geocode addresses via OpenStreetMap Nominatim (through AwsApiProxy)."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode

from app.exceptions import AppError, ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.utils import require_env

_NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"

# ISO 3166-1 alpha-2. Nominatim assigns some OSM features under CN vs HK/MO/TW;
# `countrycodes` is an OR filter (comma-separated per Nominatim Search API).
_CN_ALPHA2 = "cn"
_TERRITORIES_ALSO_INDEXED_AS_CN = frozenset({"hk", "mo", "tw"})


def _nominatim_countrycodes(country_code: str | None) -> str | None:
    """Build Nominatim ``countrycodes`` query value, or None to omit the filter."""
    if not country_code:
        return None
    cc = country_code.strip().lower()
    if len(cc) != 2 or not cc.isalpha():
        return None
    if cc in _TERRITORIES_ALSO_INDEXED_AS_CN:
        return f"{cc},{_CN_ALPHA2}"
    return cc


def geocode_address_with_context(
    *,
    address: str,
    area_context: str,
    country_code: str | None,
) -> tuple[float, float, str | None]:
    """Return (lat, lng, display_name) for a free-text address with area context.

    Args:
        address: Street or venue address (trimmed).
        area_context: Comma-separated geographic names (e.g. city, region).
        country_code: Optional ISO 3166-1 alpha-2 for ``countrycodes`` filter.
            For HK, MO, and TW the value sent is ``hk,cn`` (etc.) so Nominatim
            matches features indexed under either territory or China.

    Raises:
        ValidationError: When input is empty or Nominatim returns no results.
        AppError: On proxy failures, bad HTTP status, or invalid response payload.
    """
    addr = address.strip()
    if not addr:
        raise ValidationError("address is required", field="address")

    query_parts = [addr]
    ctx = area_context.strip()
    if ctx:
        query_parts.append(ctx)
    q = ", ".join(query_parts)

    params: dict[str, str | int] = {
        "format": "json",
        "limit": 1,
        "q": q,
    }
    codes = _nominatim_countrycodes(country_code)
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
