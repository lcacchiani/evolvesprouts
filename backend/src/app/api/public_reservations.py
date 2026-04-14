"""Public reservation submission handlers."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from decimal import InvalidOperation
from typing import Any
from collections.abc import Mapping
from urllib.parse import quote

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_email, validate_string_length
from app.exceptions import ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.services.public_form_internal_notifications import (
    build_reservation_recap_lines,
    send_sales_form_recap_email,
)
from app.services.stripe_payment_context import resolve_public_www_stripe_secret_key
from app.services.turnstile import (
    extract_client_ip,
    extract_turnstile_token,
    verify_turnstile_token,
)
from app.utils import json_response
from app.utils.logging import get_logger, mask_email, mask_pii

logger = get_logger(__name__)

_MAX_NAME_LENGTH = 200
_MAX_PHONE_LENGTH = 40
_MAX_LABEL_LENGTH = 200
_MAX_PAYMENT_METHOD_LENGTH = 100
_MAX_TOPICS_LENGTH = 1000
_MAX_TOTAL_AMOUNT = Decimal("1000000")
_STRIPE_PAYMENT_INTENTS_URL_PREFIX = "https://api.stripe.com/v1/payment_intents/"
_STRIPE_PAYMENT_INTENT_ID_PATTERN = re.compile(r"^pi_[A-Za-z0-9]+$")


def _handle_public_reservation(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle public reservation submissions."""
    if method != "POST":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    turnstile_token = extract_turnstile_token(event)
    if not turnstile_token:
        return json_response(
            400,
            {"error": "Missing X-Turnstile-Token header"},
            event=event,
        )

    remote_ip = extract_client_ip(event)
    is_turnstile_valid = verify_turnstile_token(turnstile_token, remote_ip=remote_ip)
    if not is_turnstile_valid:
        return json_response(
            403,
            {"error": "Captcha verification failed"},
            event=event,
        )

    body = parse_body(event)
    reservation_payload = _validate_reservation_payload(body)
    try:
        _validate_payment_confirmation(event, reservation_payload)
    except ValidationError as exc:
        return json_response(
            exc.status_code,
            exc.to_dict(),
            event=event,
        )
    _send_reservation_email(reservation_payload)

    logger.info(
        "Public reservation accepted",
        extra={
            "attendee_email": mask_email(reservation_payload["attendee_email"]),
            "attendee_phone": mask_pii(reservation_payload["attendee_phone"]),
            "course_label": reservation_payload["course_label"],
        },
    )

    return json_response(
        202,
        {"message": "Reservation submitted"},
        event=event,
    )


def _validate_reservation_payload(body: Mapping[str, Any]) -> dict[str, Any]:
    """Validate reservation payload and return normalized values."""
    attendee_name = _require_text(
        body.get("attendeeName"),
        "attendeeName",
        _MAX_NAME_LENGTH,
    )
    attendee_email = validate_email(body.get("attendeeEmail"))
    if attendee_email is None:
        raise ValidationError("attendeeEmail is required", field="attendeeEmail")

    attendee_phone = _require_text(
        body.get("attendeePhone"),
        "attendeePhone",
        _MAX_PHONE_LENGTH,
    )
    child_age_group = _require_text(
        body.get("childAgeGroup"),
        "childAgeGroup",
        _MAX_LABEL_LENGTH,
    )
    package_label = _require_text(
        body.get("packageLabel"),
        "packageLabel",
        _MAX_LABEL_LENGTH,
    )
    month_label = _require_text(
        body.get("monthLabel"),
        "monthLabel",
        _MAX_LABEL_LENGTH,
    )
    payment_method = _require_text(
        body.get("paymentMethod"),
        "paymentMethod",
        _MAX_PAYMENT_METHOD_LENGTH,
    )
    course_label = _require_text(
        body.get("courseLabel"),
        "courseLabel",
        _MAX_LABEL_LENGTH,
    )
    total_amount = _parse_total_amount(body.get("totalAmount"))
    stripe_payment_intent_id = _optional_text(
        body.get("stripe_payment_intent_id"),
        "stripe_payment_intent_id",
        200,
    )
    schedule_date_label = _optional_text(
        body.get("scheduleDateLabel"),
        "scheduleDateLabel",
        _MAX_LABEL_LENGTH,
    )
    schedule_time_label = _optional_text(
        body.get("scheduleTimeLabel"),
        "scheduleTimeLabel",
        _MAX_LABEL_LENGTH,
    )
    interested_topics = _optional_text(
        body.get("interestedTopics"),
        "interestedTopics",
        _MAX_TOPICS_LENGTH,
    )
    consultation_writing_focus_label = _optional_text(
        body.get("consultationWritingFocusLabel")
        or body.get("consultation_writing_focus_label"),
        "consultationWritingFocusLabel",
        _MAX_LABEL_LENGTH,
    )
    consultation_level_label = _optional_text(
        body.get("consultationLevelLabel") or body.get("consultation_level_label"),
        "consultationLevelLabel",
        _MAX_LABEL_LENGTH,
    )
    comments_field_label = _optional_text(
        body.get("commentsFieldLabel") or body.get("comments_field_label"),
        "commentsFieldLabel",
        _MAX_LABEL_LENGTH,
    )

    return {
        "attendee_name": attendee_name,
        "attendee_email": attendee_email,
        "attendee_phone": attendee_phone,
        "child_age_group": child_age_group,
        "package_label": package_label,
        "month_label": month_label,
        "payment_method": payment_method,
        "total_amount": total_amount,
        "course_label": course_label,
        "schedule_date_label": schedule_date_label,
        "schedule_time_label": schedule_time_label,
        "interested_topics": interested_topics,
        "stripe_payment_intent_id": stripe_payment_intent_id,
        "consultation_writing_focus_label": consultation_writing_focus_label,
        "consultation_level_label": consultation_level_label,
        "comments_field_label": comments_field_label,
    }


def _validate_payment_confirmation(
    event: Mapping[str, Any],
    reservation_payload: Mapping[str, Any],
) -> None:
    """Validate Stripe payment confirmation details for Stripe reservations."""
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
            "stripe_payment_intent_id is required for Stripe payment method",
            field="stripe_payment_intent_id",
        )

    if not _STRIPE_PAYMENT_INTENT_ID_PATTERN.match(stripe_payment_intent_id):
        raise ValidationError(
            "stripe_payment_intent_id must be a valid PaymentIntent id",
            field="stripe_payment_intent_id",
        )

    stripe_secret_key = resolve_public_www_stripe_secret_key(event)
    if not stripe_secret_key:
        logger.error(
            "Stripe secret key is not configured for reservation payment verification"
        )
        raise ValidationError(
            "Payment verification is unavailable. Please try again later.",
            field="stripe_payment_intent_id",
        )

    stripe_intent = _retrieve_stripe_payment_intent(
        stripe_secret_key=stripe_secret_key,
        payment_intent_id=stripe_payment_intent_id,
    )
    _assert_stripe_payment_matches_reservation(
        stripe_intent=stripe_intent,
        reservation_payload=reservation_payload,
    )


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
            field="stripe_payment_intent_id",
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
            field="stripe_payment_intent_id",
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
            field="stripe_payment_intent_id",
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
            field="stripe_payment_intent_id",
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


def _send_reservation_email(reservation_payload: Mapping[str, Any]) -> None:
    """Best-effort reservation recap to Cognito admin-group emails (never raises)."""
    send_sales_form_recap_email(
        form_title="Reservation",
        body_lines=build_reservation_recap_lines(payload=reservation_payload),
        required=False,
        retry_transient_failures=True,
    )


def _require_text(value: Any, field_name: str, max_length: int) -> str:
    """Validate and require a non-empty string field."""
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
    """Validate an optional text field."""
    return validate_string_length(
        value,
        field_name=field_name,
        max_length=max_length,
        required=False,
    )


def _parse_total_amount(value: Any) -> Decimal:
    """Validate and normalize total amount."""
    if value is None:
        raise ValidationError("totalAmount is required", field="totalAmount")

    try:
        parsed_amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValidationError(
            "totalAmount must be numeric", field="totalAmount"
        ) from exc

    if parsed_amount < 0:
        raise ValidationError(
            "totalAmount must be greater than or equal to 0",
            field="totalAmount",
        )
    if parsed_amount > _MAX_TOTAL_AMOUNT:
        raise ValidationError(
            "totalAmount exceeds maximum allowed value",
            field="totalAmount",
        )

    return parsed_amount.quantize(Decimal("0.01"))
