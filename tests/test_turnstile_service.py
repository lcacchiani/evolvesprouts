from __future__ import annotations

from typing import Any

from app.services.turnstile import (
    extract_client_ip,
    extract_turnstile_token,
    verify_turnstile_token,
)


def test_extract_turnstile_token_is_case_insensitive() -> None:
    event = {
        "headers": {
            "X-Turnstile-Token": "token-one",
        }
    }
    assert extract_turnstile_token(event) == "token-one"

    lowercase_event = {
        "headers": {
            "x-turnstile-token": "token-two",
        }
    }
    assert extract_turnstile_token(lowercase_event) == "token-two"


def test_extract_client_ip_uses_forwarded_for_header() -> None:
    event = {
        "headers": {"X-Forwarded-For": "203.0.113.10, 198.51.100.4"},
    }

    assert extract_client_ip(event) == "203.0.113.10"


def test_verify_turnstile_token_returns_false_without_secret(
    monkeypatch: Any,
) -> None:
    monkeypatch.delenv("TURNSTILE_SECRET_KEY", raising=False)

    assert verify_turnstile_token("token") is False


def test_verify_turnstile_token_returns_true_on_success(
    monkeypatch: Any,
    turnstile_http_success_response: Any,
) -> None:
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "test-secret")
    monkeypatch.setattr(
        "app.services.turnstile.http_invoke",
        turnstile_http_success_response,
    )

    assert verify_turnstile_token("token", remote_ip="203.0.113.10") is True


def test_verify_turnstile_token_returns_false_on_proxy_error(
    monkeypatch: Any,
    turnstile_http_proxy_error: Any,
) -> None:
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "test-secret")
    monkeypatch.setattr(
        "app.services.turnstile.http_invoke",
        turnstile_http_proxy_error,
    )

    assert verify_turnstile_token("token") is False
