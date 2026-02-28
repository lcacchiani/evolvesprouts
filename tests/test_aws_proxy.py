from __future__ import annotations

from typing import Any

from app.services import aws_proxy


def test_handle_aws_blocks_actions_not_in_allow_list(monkeypatch: Any) -> None:
    monkeypatch.setenv("ALLOWED_ACTIONS", "cognito-idp:list_users")
    aws_proxy._ALLOWED_ACTIONS = None

    response = aws_proxy._handle_aws(
        {
            "service": "s3",
            "action": "list_buckets",
            "params": {},
        }
    )

    assert response["error"]["code"] == "ActionNotAllowed"


def test_handle_http_rejects_disallowed_urls(monkeypatch: Any) -> None:
    monkeypatch.setenv("ALLOWED_HTTP_URLS", "https://api.example.com/v1/")
    aws_proxy._ALLOWED_HTTP_URLS = None

    response = aws_proxy._handle_http(
        {
            "type": "http",
            "method": "GET",
            "url": "https://blocked.example.com/v1/test",
        }
    )

    assert response["error"]["code"] == "URLNotAllowed"


def test_proxy_handler_routes_http_requests(monkeypatch: Any) -> None:
    marker = {"result": {"status": 200}}
    monkeypatch.setattr(aws_proxy, "_handle_http", lambda *_: marker)

    response = aws_proxy.proxy_handler({"type": "http", "url": "https://a"}, None)
    assert response is marker
