"""Shared constants for transactional email templates.

WhatsApp links in email use ``https://wa.me/<full phone number in international
format without + or spaces>`` so they open reliably in mail clients. The public
site may still use ``wa.me/message/...`` for QR flows; see
``whatsappContact.href`` in ``apps/public_www/src/content/en.json``.
"""

from __future__ import annotations

import os

# +852 9447 9843 (see docs/architecture/marketing-stack.md)
WHATSAPP_URL = "https://wa.me/85294479843"


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
