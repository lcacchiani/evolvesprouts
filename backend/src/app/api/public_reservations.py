"""Public reservation submission handlers."""

from __future__ import annotations

import os
from decimal import Decimal
from decimal import InvalidOperation
from typing import Any
from collections.abc import Mapping

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_email, validate_string_length
from app.exceptions import ValidationError
from app.services.email import send_email
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
        _send_reservation_email(reservation_payload)
    except RuntimeError:
        logger.error("Reservation email service is not configured")
        return json_response(
            500,
            {"error": "Service configuration error. Please contact support."},
            event=event,
        )
    except Exception:
        logger.exception("Failed to send reservation email")
        return json_response(
            500,
            {"error": "Failed to submit reservation. Please try again."},
            event=event,
        )

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
    }


def _send_reservation_email(reservation_payload: Mapping[str, Any]) -> None:
    """Send reservation notification email to support."""
    source_email = os.getenv("SES_SENDER_EMAIL", "").strip()
    support_email = os.getenv("SUPPORT_EMAIL", "").strip()
    if not source_email or not support_email:
        raise RuntimeError("SES_SENDER_EMAIL and SUPPORT_EMAIL must be configured")

    email_subject = (
        f"[Public WWW] Reservation - {reservation_payload['course_label']} "
        f"({reservation_payload['month_label']})"
    )
    email_body_lines = [
        "A new reservation has been submitted via the public website.",
        "",
        f"Attendee Name: {reservation_payload['attendee_name']}",
        f"Attendee Email: {reservation_payload['attendee_email']}",
        f"Attendee Phone: {reservation_payload['attendee_phone']}",
        f"Child Age Group: {reservation_payload['child_age_group']}",
        f"Package: {reservation_payload['package_label']}",
        f"Month: {reservation_payload['month_label']}",
        f"Course: {reservation_payload['course_label']}",
        f"Payment Method: {reservation_payload['payment_method']}",
        f"Total Amount: {reservation_payload['total_amount']}",
    ]
    schedule_date_label = reservation_payload.get("schedule_date_label")
    if schedule_date_label:
        email_body_lines.append(f"Schedule Date: {schedule_date_label}")
    schedule_time_label = reservation_payload.get("schedule_time_label")
    if schedule_time_label:
        email_body_lines.append(f"Schedule Time: {schedule_time_label}")
    interested_topics = reservation_payload.get("interested_topics")
    if interested_topics:
        email_body_lines.extend(["", "Interested Topics:", interested_topics])

    send_email(
        source=source_email,
        to_addresses=[support_email],
        subject=email_subject,
        body_text="\n".join(email_body_lines),
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
