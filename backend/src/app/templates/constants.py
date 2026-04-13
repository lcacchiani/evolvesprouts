"""Shared constants for transactional email templates.

WhatsApp links in email use ``https://wa.me/<full phone number in international
format without + or spaces>`` so they open reliably in mail clients. The phone
number is read from ``PUBLIC_WWW_BUSINESS_PHONE_NUMBER`` (or
``NEXT_PUBLIC_BUSINESS_PHONE_NUMBER``) at runtime — the same env var the public
website uses. The public site may still use ``wa.me/message/...`` for QR flows;
see ``whatsappContact.href`` in ``apps/public_www/src/content/en.json``.
"""

from __future__ import annotations

import os
import re


def resolve_business_phone_digits() -> str:
    """Return digits-only business phone from env, or empty string."""
    for name in (
        "PUBLIC_WWW_BUSINESS_PHONE_NUMBER",
        "NEXT_PUBLIC_BUSINESS_PHONE_NUMBER",
    ):
        raw = os.getenv(name, "")
        if isinstance(raw, str) and raw.strip():
            return re.sub(r"\D", "", raw.strip())
    return ""


def build_whatsapp_phone_url() -> str:
    """Build ``https://wa.me/<digits>`` from the business phone env var."""
    digits = resolve_business_phone_digits()
    if not digits:
        return ""
    return f"https://wa.me/{digits}"


def resolve_public_www_base_url() -> str:
    """Return configured public website origin (no trailing slash)."""
    raw = os.getenv("PUBLIC_WWW_BASE_URL", "").strip().rstrip("/")
    return raw


def build_faq_url(*, locale: str) -> str:
    """Build URL to the Contact Us page FAQ block (matches ``contact-us-faq`` section)."""
    base = resolve_public_www_base_url()
    if not base:
        return ""
    loc = locale.strip() if locale.strip() else "en"
    return f"{base}/{loc}/contact-us#contact-us-faq"
