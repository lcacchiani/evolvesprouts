from __future__ import annotations

from typing import Any

from app.api.assets.assets_common import signed_link_no_cache_headers
from app.api.assets.share_links import (
    build_share_link_url,
    generate_share_token,
    is_valid_share_token,
)


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
