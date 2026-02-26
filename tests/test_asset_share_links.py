from __future__ import annotations

from typing import Any

import pytest

from app.api.assets.assets_common import signed_link_no_cache_headers
from app.api.assets.share_links import (
    extract_request_source_domain,
    build_share_link_url,
    generate_share_token,
    is_valid_share_token,
    normalize_allowed_domains,
)
from app.exceptions import ValidationError


def test_generate_share_token_is_url_safe() -> None:
    token = generate_share_token()
    assert is_valid_share_token(token) is True


def test_is_valid_share_token_rejects_invalid_values() -> None:
    assert is_valid_share_token("short-token") is False
    assert is_valid_share_token("invalid token with spaces") is False
    assert is_valid_share_token("x" * 129) is False


def test_build_share_link_url_prefers_configured_base(monkeypatch: Any) -> None:
    monkeypatch.setenv("ASSET_SHARE_LINK_BASE_URL", "https://share.example.com/")
    url = build_share_link_url(event={}, token="A" * 24)
    assert url == "https://share.example.com/v1/assets/share/" + ("A" * 24)


def test_build_share_link_url_derives_stage_prefix(monkeypatch: Any) -> None:
    monkeypatch.delenv("ASSET_SHARE_LINK_BASE_URL", raising=False)
    event = {
        "headers": {
            "Host": "abc123.execute-api.ap-southeast-1.amazonaws.com",
            "X-Forwarded-Proto": "https",
        },
        "path": "/v1/admin/assets/9f0b/share-link",
        "requestContext": {
            "path": "/prod/v1/admin/assets/9f0b/share-link",
        },
    }
    url = build_share_link_url(event=event, token="B" * 24)
    assert (
        url
        == "https://abc123.execute-api.ap-southeast-1.amazonaws.com/prod/v1/assets/share/"
        + ("B" * 24)
    )


def test_signed_link_no_cache_headers_are_strict() -> None:
    headers = signed_link_no_cache_headers()
    assert headers["Cache-Control"] == (
        "no-store, no-cache, must-revalidate, private, max-age=0"
    )
    assert headers["Pragma"] == "no-cache"
    assert headers["Expires"] == "0"


def test_normalize_allowed_domains_accepts_urls_and_deduplicates() -> None:
    allowed_domains = normalize_allowed_domains(
        [
            "https://www.evolvesprouts.com/page",
            "WWW.EVOLVESPROUTS.COM",
            "www-staging.evolvesprouts.com",
        ]
    )
    assert allowed_domains == [
        "www.evolvesprouts.com",
        "www-staging.evolvesprouts.com",
    ]


def test_normalize_allowed_domains_rejects_invalid_input() -> None:
    with pytest.raises(ValidationError):
        normalize_allowed_domains(["not a domain"])


def test_extract_request_source_domain_prefers_referer() -> None:
    event = {
        "headers": {
            "Referer": "https://www.evolvesprouts.com/articles/downloads",
            "Origin": "https://ignored.example.com",
        }
    }
    assert extract_request_source_domain(event) == "www.evolvesprouts.com"


def test_extract_request_source_domain_uses_origin_fallback() -> None:
    event = {"headers": {"Origin": "https://www.evolvesprouts.com"}}
    assert extract_request_source_domain(event) == "www.evolvesprouts.com"


def test_extract_request_source_domain_returns_none_for_invalid_header() -> None:
    event = {"headers": {"Referer": "bad value"}}
    assert extract_request_source_domain(event) is None
