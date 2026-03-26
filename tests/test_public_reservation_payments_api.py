from __future__ import annotations

import json
from typing import Any

from app.api.admin import _safe_handler
from app.api.public_reservation_payments import handle_public_reservation_payment_intent
from app.services.aws_proxy import AwsProxyError


def _valid_payment_body() -> dict[str, Any]:
    return {
        "cohort_age": "3-4 years",
        "cohort_date": "2026-04",
        "price": 120.5,
    }


def test_payment_intent_rejects_non_post(api_gateway_event: Any) -> None:
    event = api_gateway_event(method="GET", path="/v1/reservations/payment-intent")

    response = handle_public_reservation_payment_intent(event, "GET")

    assert response["statusCode"] == 405
    assert json.loads(response["body"]) == {"error": "Method not allowed"}


def test_payment_intent_requires_turnstile_header(api_gateway_event: Any, monkeypatch: Any) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/reservations/payment-intent",
        body=json.dumps(_valid_payment_body()),
    )
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_test_123")

    response = handle_public_reservation_payment_intent(event, "POST")

    assert response["statusCode"] == 400
    assert json.loads(response["body"]) == {"error": "Missing X-Turnstile-Token header"}


def test_payment_intent_rejects_failed_turnstile(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/reservations/payment-intent",
        body=json.dumps(_valid_payment_body()),
        headers={"X-Turnstile-Token": "test-token"},
    )
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setattr(
        "app.api.public_reservation_payments.verify_turnstile_token",
        lambda *_args, **_kwargs: False,
    )

    response = handle_public_reservation_payment_intent(event, "POST")

    assert response["statusCode"] == 403
    assert json.loads(response["body"]) == {"error": "Captcha verification failed"}


def test_payment_intent_maps_proxy_runtime_error_to_bad_gateway(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/reservations/payment-intent",
        body=json.dumps(_valid_payment_body()),
        headers={"X-Turnstile-Token": "test-token"},
    )
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setattr(
        "app.api.public_reservation_payments.verify_turnstile_token",
        lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        "app.api.public_reservation_payments.http_invoke",
        lambda **_: (_ for _ in ()).throw(
            RuntimeError("AWS_PROXY_FUNCTION_ARN is not configured")
        ),
    )

    response = handle_public_reservation_payment_intent(event, "POST")

    assert response["statusCode"] == 502
    assert json.loads(response["body"]) == {
        "error": "Unable to initialize payment. Please try again."
    }


def test_payment_intent_maps_proxy_error_to_bad_gateway(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/reservations/payment-intent",
        body=json.dumps(_valid_payment_body()),
        headers={"X-Turnstile-Token": "test-token"},
    )
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setattr(
        "app.api.public_reservation_payments.verify_turnstile_token",
        lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        "app.api.public_reservation_payments.http_invoke",
        lambda **_: (_ for _ in ()).throw(AwsProxyError("ProxyError", "blocked")),
    )

    response = handle_public_reservation_payment_intent(event, "POST")

    assert response["statusCode"] == 502
    assert json.loads(response["body"]) == {
        "error": "Unable to initialize payment. Please try again."
    }


def test_payment_intent_rejects_non_object_json_body(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/reservations/payment-intent",
        body=json.dumps(["not", "an", "object"]),
        headers={"X-Turnstile-Token": "test-token"},
    )
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setattr(
        "app.api.public_reservation_payments.verify_turnstile_token",
        lambda *_args, **_kwargs: True,
    )

    response = _safe_handler(
        lambda: handle_public_reservation_payment_intent(event, "POST"), event
    )

    assert response["statusCode"] == 400
    assert json.loads(response["body"]) == {"error": "Request body must be a JSON object"}


def test_payment_intent_returns_client_secret_on_success(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/reservations/payment-intent",
        body=json.dumps(_valid_payment_body()),
        headers={"X-Turnstile-Token": "test-token"},
    )
    monkeypatch.setenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setattr(
        "app.api.public_reservation_payments.verify_turnstile_token",
        lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        "app.api.public_reservation_payments.http_invoke",
        lambda **_: {
            "status": 200,
            "body": json.dumps({"id": "pi_123", "client_secret": "placeholder"}),
        },
    )

    response = handle_public_reservation_payment_intent(event, "POST")

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {
        "payment_intent_id": "pi_123",
        "client_secret": "placeholder",
    }
