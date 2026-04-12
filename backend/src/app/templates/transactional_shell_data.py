"""SES transactional template data for the shared HTML shell (logo, footer links).

Social URLs follow the same env contract as ``apps/public_www`` (``NEXT_PUBLIC_*``),
with ``PUBLIC_WWW_*`` aliases for Lambda. When Instagram/LinkedIn are unset, the
public Contact Us path is used (matches footer fallback on the website).
"""

from __future__ import annotations

import html
import os
import re
from typing import Any
from urllib.parse import urlparse, urlunparse

from app.templates.constants import WHATSAPP_URL, build_faq_url, resolve_public_www_base_url

_DEFAULT_OG_IMAGE_PATH = "/images/seo/evolvesprouts-og-default.png"

_ALLOWED_LOCALES = frozenset({"en", "zh-CN", "zh-HK"})

_THANK_YOU_HTML = {
    "en": '<p style="margin:0 0 16px;">Thank you,<br/>Evolve Sprouts</p>',
    "zh-CN": '<p style="margin:0 0 16px;">谢谢，<br/>Evolve Sprouts</p>',
    "zh-HK": '<p style="margin:0 0 16px;">謝謝，<br/>Evolve Sprouts</p>',
}

_SOCIAL_LABELS = {
    "en": ("WhatsApp", "Instagram", "LinkedIn", "Website"),
    "zh-CN": ("WhatsApp", "Instagram", "LinkedIn", "网站"),
    "zh-HK": ("WhatsApp", "Instagram", "LinkedIn", "網站"),
}

_LINK_STYLE = "color:#C84A16;font-weight:600;text-decoration:none;"
_SEP = '<span style="color:#EECAB0;"> · </span>'


def _read_env_url(*names: str) -> str | None:
    for name in names:
        raw = os.getenv(name, "")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def normalize_optional_absolute_url(value: str | None) -> str | None:
    """Return https URL string, or None if invalid (aligned with public site-config)."""
    if not value or not value.strip():
        return None
    s = value.strip()
    if s.startswith(("//", "/", "?", "#")):
        return None

    if not re.match(r"^[a-z][a-z0-9+.-]*:", s, re.IGNORECASE):
        s = f"https://{s}"

    try:
        parsed = urlparse(s)
    except ValueError:
        return None

    scheme = parsed.scheme.lower()
    if scheme not in ("https", "http"):
        return None

    host = (parsed.hostname or "").lower()
    if scheme == "http" and host != "localhost":
        return None

    return urlunparse(parsed)


def resolve_whatsapp_url_for_template() -> str:
    """WhatsApp link for SES body/footer; env overrides match the public website."""
    resolved = normalize_optional_absolute_url(
        _read_env_url("PUBLIC_WWW_WHATSAPP_URL", "NEXT_PUBLIC_WHATSAPP_URL")
    )
    if resolved:
        return resolved
    return WHATSAPP_URL


def _resolve_instagram_url() -> str | None:
    return normalize_optional_absolute_url(
        _read_env_url("PUBLIC_WWW_INSTAGRAM_URL", "NEXT_PUBLIC_INSTAGRAM_URL")
    )


def _resolve_linkedin_url() -> str | None:
    return normalize_optional_absolute_url(
        _read_env_url("PUBLIC_WWW_LINKEDIN_URL", "NEXT_PUBLIC_LINKEDIN_URL")
    )


def _build_contact_us_page_url(*, locale: str) -> str:
    base = resolve_public_www_base_url()
    if not base:
        return ""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    return f"{base}/{loc}/contact-us"


def _social_link_segment(*, href: str, label: str) -> str:
    safe_href = html.escape(href, quote=True)
    safe_label = html.escape(label)
    return f'<a href="{safe_href}" style="{_LINK_STYLE}">{safe_label}</a>'


def build_footer_social_html(*, locale: str) -> str:
    """Inline, wrapping-friendly footer links (separator is a middle dot)."""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    labels = _SOCIAL_LABELS[loc]

    contact_fallback = _build_contact_us_page_url(locale=loc)
    wa_href = resolve_whatsapp_url_for_template()
    ig_href = _resolve_instagram_url() or contact_fallback
    li_href = _resolve_linkedin_url() or contact_fallback
    base = resolve_public_www_base_url()
    web_href = f"{base}/{loc}/" if base else ""

    segments: list[str] = []
    if wa_href:
        segments.append(_social_link_segment(href=wa_href, label=labels[0]))
    if ig_href:
        segments.append(_social_link_segment(href=ig_href, label=labels[1]))
    if li_href:
        segments.append(_social_link_segment(href=li_href, label=labels[2]))
    if web_href:
        segments.append(_social_link_segment(href=web_href, label=labels[3]))

    if not segments:
        return ""

    inner = _SEP.join(segments)
    return (
        f'<p style="margin:0;text-align:center;font-size:13px;line-height:1.8;">{inner}</p>'
    )


def build_footer_block_html(*, locale: str) -> str:
    """Thank-you line, rule, and social links for the shell footer."""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    thank = _THANK_YOU_HTML[loc]
    hr = '<hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 16px 0;"/>'
    social = build_footer_social_html(locale=loc)
    if social:
        return thank + hr + social
    return thank + hr


def build_transactional_template_shell_data(*, locale: str) -> dict[str, str]:
    """Keys required by ``wrap_transactional_html`` for SES Handlebars rendering."""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    base = resolve_public_www_base_url()
    logo_url = f"{base}{_DEFAULT_OG_IMAGE_PATH}" if base else ""
    site_home_url = f"{base}/{loc}/" if base else ""

    return {
        "logo_url": logo_url,
        "site_home_url": site_home_url,
        "faq_url": build_faq_url(locale=loc),
        "footer_block_html": build_footer_block_html(locale=loc),
    }


def merge_transactional_shell_template_data(
    *,
    locale: str,
    template_data: dict[str, Any],
) -> dict[str, Any]:
    """Shell keys first; caller values override on key collision."""
    merged: dict[str, Any] = dict(build_transactional_template_shell_data(locale=locale))
    merged.update(template_data)
    return merged
