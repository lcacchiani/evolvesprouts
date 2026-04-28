"""Cursor and request-id helpers for admin services APIs."""

from __future__ import annotations

import base64
import json
from uuid import UUID

from app.api.admin_request import (
    encode_created_cursor,
    parse_created_cursor,
    request_id,
)
from app.db.models import DiscountCode, Enrollment, Service, ServiceInstance
from app.exceptions import ValidationError
from app.utils.logging import get_logger

logger = get_logger(__name__)


def encode_service_cursor(service: Service) -> str | None:
    """Encode service list cursor (title sort, ascending)."""
    return encode_service_list_cursor(service.title, service.id)


def encode_service_list_cursor(title: str, row_id: UUID) -> str | None:
    """Encode title/id cursor for service template list pagination."""
    payload = json.dumps({"title": title, "id": str(row_id)}).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")


def parse_service_list_cursor(cursor: str | None) -> tuple[str | None, UUID | None]:
    """Parse service list cursor (title + id); empty input returns (None, None)."""
    if not cursor:
        return None, None
    try:
        padded = cursor + ("=" * (-len(cursor) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded))
        title_raw = payload["title"]
        row_id_raw = payload["id"]
        if not isinstance(title_raw, str):
            raise ValueError("title must be a string")
        return title_raw, UUID(str(row_id_raw))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        logger.warning(
            "Invalid pagination cursor", extra={"cursor_length": len(cursor)}
        )
        raise ValidationError("Invalid cursor", field="cursor") from exc


def encode_instance_cursor(instance: ServiceInstance) -> str | None:
    """Encode instance cursor for pagination."""
    return encode_created_cursor(instance.created_at, instance.id)


def encode_enrollment_cursor(enrollment: Enrollment) -> str | None:
    """Encode enrollment cursor for pagination."""
    return encode_created_cursor(enrollment.created_at, enrollment.id)


def encode_discount_code_cursor(code: DiscountCode) -> str | None:
    """Encode discount-code cursor for pagination."""
    return encode_created_cursor(code.created_at, code.id)
