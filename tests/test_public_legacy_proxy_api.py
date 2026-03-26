from __future__ import annotations

import json
from typing import Any

from app.api.public_legacy_proxy import (
    handle_legacy_contact_us,
    handle_legacy_discount_validate,
    handle_legacy_reservations,
)
from app.services.aws_proxy import AwsProxyError


def test_legacy_reservations_rejects_non_post(api_gateway_event: Any) -> None:
    event = api_gateway_event(method="GET", path="/v1/legacy/reservations")

    response = handle_legacy_reservations(event, "GET")

    assert response["statusCode"] == 405
    assert json.loads(response["body"]) == {"error": "Method not allowed"}


def test_legacy_proxy_requires_base_url(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/legacy/contact-us",
        body=json.dumps({"email_address": "parent@example.com", "message": "hello"}),
    )
    monkeypatch.delenv("LEGACY_PUBLIC_API_BASE_URL", raising=False)

    response = handle_legacy_contact_us(event, "POST")

    assert response["statusCode"] == 500
    assert json.loads(response["body"]) == {
        "error": "Service configuration error. Please contact support."
    }


def test_legacy_reservations_forwards_payload_and_headers(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/legacy/reservations",
        body=json.dumps({"full_name": "Ida", "email": "ida@example.com"}),
        headers={
            "x-api-key": "forwarded-key",
            "X-Turnstile-Token": "turnstile-token",
        },
    )
    monkeypatch.setenv("LEGACY_PUBLIC_API_BASE_URL", "https://legacy.example.com")
    captured: dict[str, Any] = {}

    def _http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return {"status": 202, "body": json.dumps({"message": "Accepted"})}

    monkeypatch.setattr("app.api.public_legacy_proxy.http_invoke", _http_invoke)

    response = handle_legacy_reservations(event, "POST")

    assert response["statusCode"] == 202
    assert json.loads(response["body"]) == {"message": "Accepted"}
    assert captured["method"] == "POST"
    assert captured["url"] == "https://legacy.example.com/v1/reservations"
    assert captured["headers"]["x-api-key"] == "forwarded-key"
    assert captured["headers"]["X-Turnstile-Token"] == "turnstile-token"
    assert json.loads(captured["body"]) == {
        "full_name": "Ida",
        "email": "ida@example.com",
    }


def test_legacy_discount_uses_configured_api_key_when_inbound_missing(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/legacy/discounts/validate",
        body=json.dumps({"code": "SAVE10"}),
        headers={},
    )
    monkeypatch.setenv("LEGACY_PUBLIC_API_BASE_URL", "https://legacy.example.com")
    monkeypatch.setenv("LEGACY_PUBLIC_API_KEY", "legacy-upstream-key")
    captured: dict[str, Any] = {}

    def _http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return {"status": 200, "body": json.dumps({"valid": True})}

    monkeypatch.setattr("app.api.public_legacy_proxy.http_invoke", _http_invoke)

    response = handle_legacy_discount_validate(event, "POST")

    assert response["statusCode"] == 200
    assert captured["headers"]["x-api-key"] == "legacy-upstream-key"
    assert "X-Turnstile-Token" not in captured["headers"]


def test_legacy_proxy_maps_proxy_error_to_bad_gateway(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/legacy/contact-us",
        body=json.dumps({"email_address": "parent@example.com", "message": "hello"}),
    )
    monkeypatch.setenv("LEGACY_PUBLIC_API_BASE_URL", "https://legacy.example.com")
    monkeypatch.setattr(
        "app.api.public_legacy_proxy.http_invoke",
        lambda **_: (_ for _ in ()).throw(AwsProxyError("URLNotAllowed", "blocked")),
    )

    response = handle_legacy_contact_us(event, "POST")

    assert response["statusCode"] == 502
    assert json.loads(response["body"]) == {
        "error": "Unable to process request. Please try again."
    }


def test_legacy_proxy_normalizes_retryable_upstream_failures(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/legacy/contact-us",
        body=json.dumps({"email_address": "parent@example.com", "message": "hello"}),
    )
    monkeypatch.setenv("LEGACY_PUBLIC_API_BASE_URL", "https://legacy.example.com")
    monkeypatch.setattr(
        "app.api.public_legacy_proxy.http_invoke",
        lambda **_: {"status": 503, "body": "upstream down"},
    )

    response = handle_legacy_contact_us(event, "POST")

    assert response["statusCode"] == 502
    assert json.loads(response["body"]) == {
        "error": "Unable to process request. Please try again."
    }
