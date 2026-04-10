"""Shared constants for transactional email templates.

Keep WHATSAPP_URL aligned with ``whatsappContact.href`` in
``apps/public_www/src/content/en.json``.
"""

from __future__ import annotations

import os

WHATSAPP_URL = "https://wa.me/message/ZQHVW4DEORD5A1?src=qr"


def resolve_public_www_base_url() -> str:
    """Return configured public website origin (no trailing slash)."""
    raw = os.getenv("PUBLIC_WWW_BASE_URL", "").strip().rstrip("/")
    return raw


def build_faq_url(*, locale: str) -> str:
    """Build a locale-prefixed FAQ page URL under the public site."""
    base = resolve_public_www_base_url()
    if not base:
        return ""
    loc = locale.strip() if locale.strip() else "en"
    return f"{base}/{loc}/about-us"
