"""SES transactional template data for the shared HTML shell (logo, footer links).

Social URLs are read from ``PUBLIC_WWW_*`` (Lambda/CDK) with ``NEXT_PUBLIC_*`` as
aliases for local/tests. **Vercel build env is not injected into API Lambdas**:
CloudFormation parameters ``PublicWwwInstagramUrl`` / ``PublicWwwLinkedinUrl``
must be set to the same values as the public site, or those footer icons are
omitted. Values that resolve to the public site hostname (mis-set to a page on
this domain instead of Instagram/LinkedIn) are treated as invalid and omitted.
"""

from __future__ import annotations

import html
import os
import re
from typing import Any
from urllib.parse import parse_qsl, quote, urlparse, urlencode, urlunparse

from app.templates.constants import (
    build_faq_url,
    build_whatsapp_phone_url,
    resolve_public_www_base_url,
)

_DEFAULT_OG_IMAGE_PATH = "/images/seo/evolvesprouts-og-default.png"

_ALLOWED_LOCALES = frozenset({"en", "zh-CN", "zh-HK"})

_THANK_YOU_HTML = {
    "en": '<p style="margin:0 0 16px;">Thank you,<br/>Evolve Sprouts</p>',
    "zh-CN": '<p style="margin:0 0 16px;">谢谢，<br/>Evolve Sprouts</p>',
    "zh-HK": '<p style="margin:0 0 16px;">謝謝，<br/>Evolve Sprouts</p>',
}

_FREE_INTRO_WHATSAPP_PREFILL = {
    "en": "Hi, I'd like to book a free intro call!",
    "zh-CN": "您好，我想预约免费咨询通话！",
    "zh-HK": "您好，我想預約免費諮詢通話！",
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


def _coerce_whatsapp_url_for_email(url: str) -> str:
    """Prefer ``https://wa.me/<digits>``; ``/message/...`` short links often fail in email."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return url
    host = (parsed.hostname or "").lower()
    if host not in ("wa.me", "www.wa.me"):
        return url
    path = parsed.path.strip("/")
    if path.lower().startswith("message/"):
        phone_url = build_whatsapp_phone_url()
        return phone_url if phone_url else url
    return url


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
        return _coerce_whatsapp_url_for_email(resolved)
    return build_whatsapp_phone_url()


def _resolve_instagram_url() -> str | None:
    return normalize_optional_absolute_url(
        _read_env_url("PUBLIC_WWW_INSTAGRAM_URL", "NEXT_PUBLIC_INSTAGRAM_URL")
    )


def _resolve_linkedin_url() -> str | None:
    return normalize_optional_absolute_url(
        _read_env_url("PUBLIC_WWW_LINKEDIN_URL", "NEXT_PUBLIC_LINKEDIN_URL")
    )


def _public_www_hostname() -> str | None:
    base = resolve_public_www_base_url()
    if not base:
        return None
    try:
        host = urlparse(base).hostname
    except ValueError:
        return None
    return host.lower() if host else None


def _external_profile_url_or_none(raw: str | None) -> str | None:
    """Drop URLs that point at our own site (common misconfiguration in CDK params)."""
    if not raw:
        return None
    site_host = _public_www_hostname()
    if not site_host:
        return raw
    try:
        link_host = urlparse(raw).hostname
    except ValueError:
        return None
    if not link_host:
        return None
    if link_host.lower() == site_host:
        return None
    return raw


def _build_contact_us_page_url(*, locale: str) -> str:
    base = resolve_public_www_base_url()
    if not base:
        return ""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    return f"{base}/{loc}/contact-us"


def build_my_best_auntie_training_page_url(*, locale: str) -> str:
    """Public WWW URL for the My Best Auntie training course page."""
    base = resolve_public_www_base_url()
    if not base:
        return ""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    return f"{base}/{loc}/services/my-best-auntie-training-course"


def build_free_intro_call_url(*, locale: str) -> str:
    """WhatsApp deep link with intro-call prefill, or contact page if WhatsApp is unavailable."""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    prefill = _FREE_INTRO_WHATSAPP_PREFILL[loc]
    base_wa = resolve_whatsapp_url_for_template()
    if not base_wa:
        return _build_contact_us_page_url(locale=loc)
    try:
        parsed = urlparse(base_wa)
    except ValueError:
        return _build_contact_us_page_url(locale=loc)
    pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k != "text"
    ]
    pairs.append(("text", prefill))
    new_query = urlencode(pairs, safe="", quote_via=quote)
    return urlunparse(parsed._replace(query=new_query))


def _social_link_segment(*, href: str, label: str) -> str:
    safe_href = html.escape(href, quote=True)
    safe_label = html.escape(label)
    return f'<a href="{safe_href}" style="{_LINK_STYLE}">{safe_label}</a>'


def build_footer_social_html(*, locale: str) -> str:
    """Inline, wrapping-friendly footer links (separator is a middle dot)."""
    loc = locale if locale in _ALLOWED_LOCALES else "en"
    labels = _SOCIAL_LABELS[loc]

    wa_href = resolve_whatsapp_url_for_template()
    ig_href = _external_profile_url_or_none(_resolve_instagram_url())
    li_href = _external_profile_url_or_none(_resolve_linkedin_url())
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
    return f'<p style="margin:0;text-align:center;font-size:13px;line-height:1.8;">{inner}</p>'


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
        "my_best_auntie_url": build_my_best_auntie_training_page_url(locale=loc),
        "free_intro_call_url": build_free_intro_call_url(locale=loc),
    }


def merge_transactional_shell_template_data(
    *,
    locale: str,
    template_data: dict[str, Any],
) -> dict[str, Any]:
    """Shell keys first; caller values override on key collision."""
    merged: dict[str, Any] = dict(
        build_transactional_template_shell_data(locale=locale)
    )
    merged.update(template_data)
    return merged
