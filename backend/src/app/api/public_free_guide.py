"""Public free-guide lead capture endpoint handlers."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from typing import Any
from collections.abc import Mapping

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_email, validate_string_length
from app.exceptions import ValidationError
from app.services.aws_clients import get_sns_client
from app.services.turnstile import (
    extract_client_ip,
    extract_turnstile_token,
    verify_turnstile_token,
)
from app.utils import json_response
from app.utils.logging import get_logger, mask_email

logger = get_logger(__name__)

_MAX_FIRST_NAME_LENGTH = 100
_EVENT_TYPE = "free_guide_request.submitted"


def handle_free_guide_request(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle free-guide form submissions from the public website."""
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
    if not verify_turnstile_token(turnstile_token, remote_ip=remote_ip):
        return json_response(
            403,
            {"error": "Captcha verification failed"},
            event=event,
        )

    body = parse_body(event)
    first_name = _validate_first_name(body.get("first_name"))
    email = _validate_required_email(body.get("email"))

    topic_arn = os.getenv("FREE_GUIDE_TOPIC_ARN", "").strip()
    if not topic_arn:
        logger.error("FREE_GUIDE_TOPIC_ARN is not configured")
        return json_response(
            500,
            {"error": "Service configuration error. Please contact support."},
            event=event,
        )

    request_id = str(event.get("requestContext", {}).get("requestId", "")).strip()
    message_payload = {
        "event_type": _EVENT_TYPE,
        "first_name": first_name,
        "email": email,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
    }

    try:
        get_sns_client().publish(
            TopicArn=topic_arn,
            Message=json.dumps(message_payload),
            MessageAttributes={
                "event_type": {
                    "DataType": "String",
                    "StringValue": _EVENT_TYPE,
                },
            },
        )
    except Exception:
        logger.exception(
            "Failed to publish free-guide request",
            extra={"lead_email": mask_email(email)},
        )
        return json_response(
            500,
            {"error": "Failed to submit request. Please try again."},
            event=event,
        )

    logger.info(
        "Free-guide request accepted",
        extra={
            "lead_email": mask_email(email),
            "request_id": request_id,
        },
    )
    return json_response(
        202,
        {"message": "Request accepted"},
        event=event,
    )


def _validate_first_name(value: Any) -> str:
    normalized_value = validate_string_length(
        value,
        field_name="first_name",
        max_length=_MAX_FIRST_NAME_LENGTH,
        required=True,
    )
    if normalized_value is None:
        raise ValidationError("first_name is required", field="first_name")
    return normalized_value


def _validate_required_email(value: Any) -> str:
    normalized_value = validate_email(value)
    if normalized_value is None:
        raise ValidationError("email is required", field="email")
    return normalized_value
