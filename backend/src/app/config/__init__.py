"""Runtime configuration helpers (non-secret defaults)."""

from __future__ import annotations

import os

_FALLBACK_ADMIN_DEFAULT_CURRENCY = "HKD"


def get_default_currency_code() -> str:
    """Admin default ISO currency for null enrollment currency fields.

    Reads ``ADMIN_DEFAULT_CURRENCY_CODE`` (three-letter ISO). Invalid or empty
    values fall back to HKD (same contract as admin web ``NEXT_PUBLIC_ADMIN_DEFAULT_CURRENCY``).
    """
    raw = os.getenv("ADMIN_DEFAULT_CURRENCY_CODE", "").strip().upper()
    if len(raw) == 3 and raw.isalpha():
        return raw
    return _FALLBACK_ADMIN_DEFAULT_CURRENCY
