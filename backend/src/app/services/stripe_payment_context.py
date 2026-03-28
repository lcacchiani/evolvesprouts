"""Stripe secret selection for public WWW reservation payment flows."""

from __future__ import annotations

import os
from typing import Any
from collections.abc import Mapping
from urllib.parse import urlparse

from app.utils.logging import get_logger

logger = get_logger(__name__)


def _header_lookup(headers: Mapping[str, Any], name: str) -> str:
    """Return a header value with case-insensitive key matching."""
    target = name.lower()
    for key, value in headers.items():
        if str(key).lower() == target:
            return str(value).strip()
    return ""


def extract_browser_site_origin(event: Mapping[str, Any]) -> str | None:
    """Return normalized https origin from Origin or Referer, if present."""
    headers = event.get("headers")
    if not isinstance(headers, Mapping):
        return None

    raw = _header_lookup(headers, "Origin")
    if not raw:
        raw = _header_lookup(headers, "Referer")
    if not raw:
        return None

    parsed = urlparse(raw)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        return None
    origin = f"https://{parsed.netloc.lower()}"
    return origin.rstrip("/")


def resolve_public_www_stripe_secret_key(event: Mapping[str, Any]) -> str | None:
    """Pick live vs staging Stripe secret key using the caller site origin."""
    live_key = os.getenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "").strip()
    staging_key = os.getenv("EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY", "").strip()
    staging_origin = os.getenv("PUBLIC_WWW_STAGING_SITE_ORIGIN", "").strip().rstrip("/")

    if staging_origin:
        browser_origin = extract_browser_site_origin(event)
        normalized_browser = (browser_origin or "").rstrip("/")
        if normalized_browser and normalized_browser == staging_origin:
            if staging_key:
                return staging_key
            logger.error(
                "EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY is not configured for staging site origin"
            )
            return None

    if not live_key:
        return None
    return live_key
