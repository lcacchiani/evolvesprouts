"""Public reservation payment handlers.

This module creates Stripe PaymentIntents for inline booking-modal payment.
"""

from __future__ import annotations

import json
import os
from decimal import Decimal
from decimal import InvalidOperation
from typing import Any
from collections.abc import Mapping
from urllib.parse import urlencode

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_string_length
from app.exceptions import ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.services.turnstile import (
    extract_client_ip,
    extract_turnstile_token,
    verify_turnstile_token,
)
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_STRIPE_PAYMENT_INTENTS_URL = "https://api.stripe.com/v1/payment_intents"
_MAX_COHORT_AGE_LENGTH = 200
_MAX_COHORT_DATE_LENGTH = 100
_MAX_DISCOUNT_CODE_LENGTH = 100
_MAX_TOTAL_AMOUNT = Decimal("1000000")
_MIN_TOTAL_AMOUNT = Decimal("1")


def handle_public_reservation_payment_intent(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Create a Stripe PaymentIntent for the public reservation modal."""
    if method != "POST":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    stripe_secret_key = os.getenv("EVOLVESPROUTS_STRIPE_SECRET_KEY", "").strip()
    if not stripe_secret_key:
        logger.error("EVOLVESPROUTS_STRIPE_SECRET_KEY is not configured")
        return json_response(
            500,
            {"error": "Service configuration error. Please contact support."},
            event=event,
        )

    turnstile_token = extract_turnstile_token(event)
    if not turnstile_token:
        return json_response(
            400,
            {"error": "Missing X-Turnstile-Token header"},
            event=event,
        )
    remote_ip = extract_client_ip(event)
    if not verify_turnstile_token(turnstile_token, remote_ip=remote_ip):
        return json_response(
            403,
            {"error": "Captcha verification failed"},
            event=event,
        )

    body = parse_body(event)
    if not isinstance(body, Mapping):
        raise ValidationError("Request body must be a JSON object")
    payment_payload = _validate_payment_payload(body)
    amount_minor_units = _to_minor_units(payment_payload["price"])

    request_fields: dict[str, str] = {
        "amount": str(amount_minor_units),
        "currency": "hkd",
        "automatic_payment_methods[enabled]": "true",
        "description": "Evolve Sprouts reservation payment",
        "metadata[cohort_age]": payment_payload["cohort_age"],
        "metadata[cohort_date]": payment_payload["cohort_date"],
    }
    discount_code = payment_payload.get("discount_code")
    if discount_code:
        request_fields["metadata[discount_code]"] = discount_code
    payment_method_configuration_id = os.getenv(
        "EVOLVESPROUTS_STRIPE_PAYMENT_METHOD_CONFIGURATION_ID", ""
    ).strip()
    if payment_method_configuration_id:
        request_fields["payment_method_configuration"] = payment_method_configuration_id

    try:
        stripe_response = http_invoke(
            method="POST",
            url=_STRIPE_PAYMENT_INTENTS_URL,
            headers={
                "Authorization": f"Bearer {stripe_secret_key}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body=urlencode(request_fields),
            timeout=20,
        )
    except (AwsProxyError, RuntimeError) as exc:
        logger.warning(
            "Stripe payment intent request failed via proxy",
            extra={"code": getattr(exc, "code", type(exc).__name__)},
        )
        return json_response(
            502,
            {"error": "Unable to initialize payment. Please try again."},
            event=event,
        )

    status_code = _safe_status_code(stripe_response.get("status"))
    response_body = _parse_response_json(stripe_response.get("body"))
    if status_code != 200:
        logger.warning(
            "Stripe payment intent creation returned non-200 status",
            extra={"status_code": status_code},
        )
        return json_response(
            502,
            {"error": "Unable to initialize payment. Please try again."},
            event=event,
        )

    if not isinstance(response_body, Mapping):
        logger.warning("Stripe payment intent response is not a JSON object")
        return json_response(
            502,
            {"error": "Unable to initialize payment. Please try again."},
            event=event,
        )

    payment_intent_id = str(response_body.get("id") or "").strip()
    client_secret = str(response_body.get("client_secret") or "").strip()
    if not payment_intent_id or not client_secret:
        logger.warning("Stripe payment intent response is missing required fields")
        return json_response(
            502,
            {"error": "Unable to initialize payment. Please try again."},
            event=event,
        )

    return json_response(
        200,
        {
            "payment_intent_id": payment_intent_id,
            "client_secret": client_secret,
        },
        event=event,
    )


def _validate_payment_payload(body: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and normalize payment-intent request payload."""
    cohort_age = _require_text(
        body.get("cohort_age"),
        "cohort_age",
        _MAX_COHORT_AGE_LENGTH,
    )
    cohort_date = _require_text(
        body.get("cohort_date"),
        "cohort_date",
        _MAX_COHORT_DATE_LENGTH,
    )
    discount_code = _optional_text(
        body.get("discount_code"),
        "discount_code",
        _MAX_DISCOUNT_CODE_LENGTH,
    )
    price = _parse_total_amount(body.get("price"))
    return {
        "cohort_age": cohort_age,
        "cohort_date": cohort_date,
        "discount_code": discount_code,
        "price": price,
    }


def _require_text(value: Any, field_name: str, max_length: int) -> str:
    normalized = validate_string_length(
        value,
        field_name=field_name,
        max_length=max_length,
        required=True,
    )
    if normalized is None:
        raise ValidationError(f"{field_name} is required", field=field_name)
    return normalized


def _optional_text(value: Any, field_name: str, max_length: int) -> str | None:
    return validate_string_length(
        value,
        field_name=field_name,
        max_length=max_length,
        required=False,
    )


def _parse_total_amount(value: Any) -> Decimal:
    if value is None:
        raise ValidationError("price is required", field="price")
    try:
        parsed_amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValidationError("price must be numeric", field="price") from exc
    if parsed_amount < _MIN_TOTAL_AMOUNT:
        raise ValidationError(
            "price must be greater than or equal to 1",
            field="price",
        )
    if parsed_amount > _MAX_TOTAL_AMOUNT:
        raise ValidationError(
            "price exceeds maximum allowed value",
            field="price",
        )
    return parsed_amount.quantize(Decimal("0.01"))


def _to_minor_units(amount: Decimal) -> int:
    return int(amount * 100)


def _safe_status_code(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _parse_response_json(raw_body: Any) -> Mapping[str, Any] | None:
    if not isinstance(raw_body, str):
        return None
    body = raw_body.strip()
    if not body:
        return None
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, Mapping):
        return parsed
    return None
