from __future__ import annotations

from typing import Any

import pytest

from app.services.stripe_payment_context import (
    extract_browser_site_origin,
    resolve_public_www_stripe_secret_key,
)


def test_extract_browser_site_origin_from_origin_header() -> None:
    event: dict[str, Any] = {
        "headers": {"Origin": "https://www-staging.example.com/path"},
    }
    assert extract_browser_site_origin(event) == "https://www-staging.example.com"


def test_extract_browser_site_origin_from_referer_header() -> None:
    event: dict[str, Any] = {
        "headers": {"Referer": "https://WWW.EXAMPLE.COM/foo?x=1"},
    }
    assert extract_browser_site_origin(event) == "https://www.example.com"


def test_extract_browser_site_origin_rejects_non_https() -> None:
    event: dict[str, Any] = {
        "headers": {"Origin": "http://www-staging.example.com"},
    }
    assert extract_browser_site_origin(event) is None


def test_resolve_stripe_secret_prefers_staging_when_origin_matches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_live_x")
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY", "sk_test_y")
    monkeypatch.setenv(
        "PUBLIC_WWW_STAGING_SITE_ORIGIN",
        "https://www-staging.example.com",
    )
    event: dict[str, Any] = {
        "headers": {"Origin": "https://www-staging.example.com"},
    }
    assert resolve_public_www_stripe_secret_key(event) == "sk_test_y"


def test_resolve_stripe_secret_uses_live_when_origin_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_live_x")
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY", "sk_test_y")
    monkeypatch.setenv(
        "PUBLIC_WWW_STAGING_SITE_ORIGIN",
        "https://www-staging.example.com",
    )
    event: dict[str, Any] = {"headers": {}}
    assert resolve_public_www_stripe_secret_key(event) == "sk_live_x"


def test_resolve_stripe_secret_staging_origin_without_staging_key_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_live_x")
    monkeypatch.delenv("EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY", raising=False)
    monkeypatch.setenv(
        "PUBLIC_WWW_STAGING_SITE_ORIGIN",
        "https://www-staging.example.com",
    )
    event: dict[str, Any] = {
        "headers": {"Origin": "https://www-staging.example.com"},
    }
    assert resolve_public_www_stripe_secret_key(event) is None


def test_resolve_stripe_secret_without_live_key_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_STAGING_SITE_ORIGIN", raising=False)
    event: dict[str, Any] = {"headers": {}}
    assert resolve_public_www_stripe_secret_key(event) is None
