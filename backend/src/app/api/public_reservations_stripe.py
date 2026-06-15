"""Stripe payment verification helpers for public reservations."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from decimal import Decimal
from typing import Any
from urllib.parse import quote

from app.api.text_fields import optional_text as _optional_text
from app.exceptions import ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.services.stripe_payment_context import resolve_public_www_stripe_secret_key
from app.utils.logging import get_logger

logger = get_logger(__name__)

_STRIPE_PAYMENT_INTENTS_URL_PREFIX = "https://api.stripe.com/v1/payment_intents/"
_STRIPE_PAYMENT_INTENT_ID_PATTERN = re.compile(r"^pi_[A-Za-z0-9]+$")


def _stripe_payment_intent_id_from_body(body: Mapping[str, Any]) -> str | None:
    raw = body.get("stripePaymentIntentId")
    if raw is None:
        raw = body.get("stripe_payment_intent_id")
    if raw is None:
        return None
    return _optional_text(raw, "stripePaymentIntentId", 200)


def _retrieve_stripe_payment_intent(
    *,
    stripe_secret_key: str,
    payment_intent_id: str,
) -> Mapping[str, Any]:
    request_url = (
        f"{_STRIPE_PAYMENT_INTENTS_URL_PREFIX}{quote(payment_intent_id, safe='')}"
    )
    try:
        stripe_response = http_invoke(
            method="GET",
            url=request_url,
            headers={
                "Authorization": f"Bearer {stripe_secret_key}",
            },
            timeout=20,
        )
    except AwsProxyError as exc:
        logger.warning(
            "Stripe payment intent retrieval failed via proxy",
            extra={"code": exc.code},
        )
        raise ValidationError(
            "Payment verification failed. Please try again.",
            field="stripePaymentIntentId",
        ) from exc

    status_code = _safe_status_code(stripe_response.get("status"))
    response_body = _parse_response_json(stripe_response.get("body"))
    if status_code != 200 or not isinstance(response_body, Mapping):
        logger.warning(
            "Stripe payment intent retrieval returned unexpected response",
            extra={"status_code": status_code},
        )
        raise ValidationError(
            "Payment verification failed. Please try again.",
            field="stripePaymentIntentId",
        )
    return response_body


def _assert_stripe_payment_matches_reservation(
    *,
    stripe_intent: Mapping[str, Any],
    reservation_payload: Mapping[str, Any],
) -> None:
    intent_status = str(stripe_intent.get("status") or "").strip().lower()
    if intent_status != "succeeded":
        raise ValidationError(
            "Stripe payment is not confirmed",
            field="stripePaymentIntentId",
        )

    try:
        intent_amount_minor_units = int(stripe_intent.get("amount") or 0)
    except (TypeError, ValueError):
        intent_amount_minor_units = 0
    expected_amount_minor_units = int(
        Decimal(str(reservation_payload["total_amount"])) * Decimal("100")
    )
    if intent_amount_minor_units != expected_amount_minor_units:
        raise ValidationError(
            "Stripe payment amount does not match reservation amount",
            field="stripePaymentIntentId",
        )


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


def _validate_payment_confirmation(
    event: Mapping[str, Any],
    reservation_payload: dict[str, Any],
) -> None:
    """Validate Stripe payment confirmation; attach ``stripe_currency`` when Stripe."""
    payment_method = (
        str(reservation_payload.get("payment_method") or "").strip().lower()
    )
    stripe_payment_intent_id = str(
        reservation_payload.get("stripe_payment_intent_id") or ""
    ).strip()

    expects_stripe_payment = "stripe" in payment_method or "apple pay" in payment_method
    if not expects_stripe_payment:
        return

    if not stripe_payment_intent_id:
        raise ValidationError(
            "stripePaymentIntentId is required for Stripe payment method",
            field="stripePaymentIntentId",
        )

    if not _STRIPE_PAYMENT_INTENT_ID_PATTERN.match(stripe_payment_intent_id):
        raise ValidationError(
            "stripePaymentIntentId must be a valid PaymentIntent id",
            field="stripePaymentIntentId",
        )

    stripe_secret_key = resolve_public_www_stripe_secret_key(event)
    if not stripe_secret_key:
        logger.error(
            "Stripe secret key is not configured for reservation payment verification"
        )
        raise ValidationError(
            "Payment verification is unavailable. Please try again later.",
            field="stripePaymentIntentId",
        )

    stripe_intent = _retrieve_stripe_payment_intent(
        stripe_secret_key=stripe_secret_key,
        payment_intent_id=stripe_payment_intent_id,
    )
    _assert_stripe_payment_matches_reservation(
        stripe_intent=stripe_intent,
        reservation_payload=reservation_payload,
    )
    cur = str(stripe_intent.get("currency") or "hkd").upper()[:3]
    reservation_payload["stripe_currency"] = cur
