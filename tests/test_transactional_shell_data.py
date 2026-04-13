from __future__ import annotations

from typing import Any

import pytest

from app.templates.transactional_shell_data import (
    build_footer_social_html,
    build_transactional_template_shell_data,
    merge_transactional_shell_template_data,
    normalize_optional_absolute_url,
    resolve_whatsapp_url_for_template,
)

_TEST_PHONE = "+852 9447 9843"
_TEST_PHONE_DIGITS = "85294479843"
_TEST_PHONE_WA_URL = f"https://wa.me/{_TEST_PHONE_DIGITS}"


def test_normalize_optional_absolute_url() -> None:
    assert normalize_optional_absolute_url(None) is None
    assert normalize_optional_absolute_url("") is None
    assert normalize_optional_absolute_url("/relative") is None
    assert (
        normalize_optional_absolute_url("https://www.example.com/path")
        == "https://www.example.com/path"
    )
    assert (
        normalize_optional_absolute_url("instagram.com/evolvesprouts")
        == "https://instagram.com/evolvesprouts"
    )


def test_resolve_whatsapp_url_for_template_env_override(monkeypatch: Any) -> None:
    monkeypatch.setenv("PUBLIC_WWW_WHATSAPP_URL", "https://wa.me/custom")
    assert resolve_whatsapp_url_for_template() == "https://wa.me/custom"


def test_resolve_whatsapp_url_coerces_message_short_link(monkeypatch: Any) -> None:
    monkeypatch.setenv(
        "PUBLIC_WWW_WHATSAPP_URL",
        "https://wa.me/message/ZQHVW4DEORD5A1?src=qr",
    )
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", _TEST_PHONE)
    assert resolve_whatsapp_url_for_template() == _TEST_PHONE_WA_URL


def test_resolve_whatsapp_url_coerce_without_phone_keeps_original(
    monkeypatch: Any,
) -> None:
    """When phone env var is missing, coercion cannot rewrite; keep original URL."""
    monkeypatch.setenv(
        "PUBLIC_WWW_WHATSAPP_URL",
        "https://wa.me/message/ZQHVW4DEORD5A1?src=qr",
    )
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_BUSINESS_PHONE_NUMBER", raising=False)
    assert (
        resolve_whatsapp_url_for_template()
        == "https://wa.me/message/ZQHVW4DEORD5A1?src=qr"
    )


def test_resolve_whatsapp_url_for_template_falls_back_to_phone(
    monkeypatch: Any,
) -> None:
    monkeypatch.delenv("PUBLIC_WWW_WHATSAPP_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_WHATSAPP_URL", raising=False)
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", _TEST_PHONE)
    assert resolve_whatsapp_url_for_template() == _TEST_PHONE_WA_URL


def test_resolve_whatsapp_url_for_template_empty_without_env(
    monkeypatch: Any,
) -> None:
    """Without any WhatsApp or phone env vars, return empty string."""
    monkeypatch.delenv("PUBLIC_WWW_WHATSAPP_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_WHATSAPP_URL", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_BUSINESS_PHONE_NUMBER", raising=False)
    assert resolve_whatsapp_url_for_template() == ""


@pytest.mark.parametrize(
    "locale,expect_fragment",
    [
        ("en", "Thank you,"),
        ("zh-CN", "谢谢"),
        ("zh-HK", "謝謝"),
    ],
)
def test_build_transactional_template_shell_data_footer(
    monkeypatch: Any, locale: str, expect_fragment: str
) -> None:
    monkeypatch.setenv("PUBLIC_WWW_BASE_URL", "https://www.example.com")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", _TEST_PHONE)
    monkeypatch.setenv(
        "PUBLIC_WWW_INSTAGRAM_URL", "https://www.instagram.com/evolvesprouts"
    )
    monkeypatch.setenv(
        "PUBLIC_WWW_LINKEDIN_URL", "https://www.linkedin.com/company/evolve-sprouts"
    )
    data = build_transactional_template_shell_data(locale=locale)
    assert data["logo_url"] == (
        "https://www.example.com/images/seo/evolvesprouts-og-default.png"
    )
    assert data["site_home_url"] == f"https://www.example.com/{locale}/"
    assert expect_fragment in data["footer_block_html"]
    assert "Instagram" in data["footer_block_html"]
    assert "https://www.instagram.com/evolvesprouts" in data["footer_block_html"]


def test_merge_transactional_shell_template_data_order(monkeypatch: Any) -> None:
    monkeypatch.setenv("PUBLIC_WWW_BASE_URL", "https://www.example.com")
    merged = merge_transactional_shell_template_data(
        locale="en",
        template_data={"first_name": "A", "logo_url": "https://override/logo.png"},
    )
    assert merged["first_name"] == "A"
    assert merged["logo_url"] == "https://override/logo.png"


def test_build_footer_social_html_omits_instagram_linkedin_without_env(
    monkeypatch: Any,
) -> None:
    """Without PUBLIC_WWW_* social URLs, do not link IG/LI to the site (matches www footer)."""
    monkeypatch.setenv("PUBLIC_WWW_BASE_URL", "https://www.example.com")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", _TEST_PHONE)
    monkeypatch.delenv("PUBLIC_WWW_INSTAGRAM_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_INSTAGRAM_URL", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_LINKEDIN_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_LINKEDIN_URL", raising=False)
    result = build_footer_social_html(locale="en")
    assert "Instagram" not in result
    assert "LinkedIn" not in result
    assert "https://www.example.com/en/contact-us" not in result
    assert "WhatsApp" in result
    assert "Website" in result


def test_build_footer_social_html_omits_social_when_env_points_at_own_site(
    monkeypatch: Any,
) -> None:
    """CDK params sometimes copy the site URL; those must not appear as Instagram/LinkedIn."""
    monkeypatch.setenv("PUBLIC_WWW_BASE_URL", "https://www.example.com")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_PHONE_NUMBER", _TEST_PHONE)
    monkeypatch.setenv(
        "PUBLIC_WWW_INSTAGRAM_URL", "https://www.example.com/en/contact-us"
    )
    monkeypatch.setenv(
        "PUBLIC_WWW_LINKEDIN_URL", "https://www.example.com/zh-HK/contact-us"
    )
    result = build_footer_social_html(locale="en")
    assert "Instagram" not in result
    assert "LinkedIn" not in result
    assert "WhatsApp" in result
