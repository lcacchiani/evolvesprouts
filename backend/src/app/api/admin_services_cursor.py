"""Cursor and request-id helpers for admin services APIs."""

from __future__ import annotations

import base64
import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.db.models import DiscountCode, Enrollment, Service, ServiceInstance
from app.exceptions import ValidationError


def request_id(event: Mapping[str, Any]) -> str:
    """Return API Gateway request ID if present."""
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        request_id_value = request_context.get("requestId")
        if isinstance(request_id_value, str):
            return request_id_value
    return ""


def encode_service_cursor(service: Service) -> str | None:
    """Encode service cursor for pagination."""
    return encode_created_cursor(service.created_at, service.id)


def encode_instance_cursor(instance: ServiceInstance) -> str | None:
    """Encode instance cursor for pagination."""
    return encode_created_cursor(instance.created_at, instance.id)


def encode_enrollment_cursor(enrollment: Enrollment) -> str | None:
    """Encode enrollment cursor for pagination."""
    return encode_created_cursor(enrollment.created_at, enrollment.id)


def encode_discount_code_cursor(code: DiscountCode) -> str | None:
    """Encode discount-code cursor for pagination."""
    return encode_created_cursor(code.created_at, code.id)


def encode_created_cursor(created_at: datetime | None, row_id: UUID) -> str | None:
    """Encode generic created_at/id cursor."""
    if created_at is None:
        return None
    normalized_created = _normalize_datetime(created_at)
    payload = json.dumps({"created_at": normalized_created.isoformat(), "id": str(row_id)}).encode(
        "utf-8"
    )
    return base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")


def parse_created_cursor(cursor: str | None) -> tuple[datetime | None, UUID | None]:
    """Parse created_at/id cursor payload."""
    if not cursor:
        return None, None
    try:
        padded = cursor + ("=" * (-len(cursor) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded))
        created_at_raw = payload["created_at"]
        row_id_raw = payload["id"]
        if not isinstance(created_at_raw, str):
            raise ValueError("created_at must be a string")
        parsed_created_at = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
        return _normalize_datetime(parsed_created_at), UUID(str(row_id_raw))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise ValidationError("Invalid cursor", field="cursor") from exc


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
