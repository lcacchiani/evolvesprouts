from __future__ import annotations

from app.api.public_legacy_confirmation import (
    first_name_from_full_name,
    normalize_body_locale,
    resolve_email_locale_from_accept_language,
)


def test_resolve_email_locale_from_accept_language() -> None:
    assert resolve_email_locale_from_accept_language("en-US,en;q=0.9") == "en"
    assert resolve_email_locale_from_accept_language("zh-CN,en;q=0.8") == "zh-CN"
    assert resolve_email_locale_from_accept_language("zh-HK") == "zh-HK"
    assert resolve_email_locale_from_accept_language("zh-TW,en;q=0.5") == "zh-HK"
    assert resolve_email_locale_from_accept_language("") == "en"


def test_normalize_body_locale() -> None:
    assert normalize_body_locale("zh-CN") == "zh-CN"
    assert normalize_body_locale("xx") == "en"


def test_first_name_from_full_name() -> None:
    assert first_name_from_full_name("Jane Smith") == "Jane"
    assert first_name_from_full_name("Single") == "Single"
    assert first_name_from_full_name("  Pat  Lee  ") == "Pat"
