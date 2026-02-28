"""Request parsing helpers for admin APIs."""

from __future__ import annotations

import base64
import json
import os
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from app.exceptions import ValidationError
from app.utils.parsers import collect_query_params, first_param


def parse_body(event: Mapping[str, Any]) -> dict[str, Any]:
    """Parse JSON request body."""
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValidationError("Request body is not valid base64") from exc
    if not raw:
        raise ValidationError("Request body is required")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValidationError("Request body must be valid JSON") from exc


def query_param(event: Mapping[str, Any], name: str) -> str | None:
    """Return a query parameter value."""
    params = collect_query_params(event)
    return first_param(params, name)


def parse_uuid(value: str) -> UUID:
    """Parse a UUID string."""
    try:
        return UUID(value)
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"Invalid UUID: {value}", field="id") from exc


def _to_uuid(value: UUID | str) -> UUID:
    """Normalize a UUID from UUID or string input."""
    if isinstance(value, UUID):
        return value
    return parse_uuid(value)


def _parse_group_name(event: Mapping[str, Any]) -> str:
    """Parse the group name from the request."""
    raw = event.get("body") or ""
    if not raw:
        return os.getenv("ADMIN_GROUP") or "admin"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        body = {}
    group = body.get("group") if isinstance(body, dict) else None
    return group or os.getenv("ADMIN_GROUP") or "admin"


def parse_cursor(value: str | None) -> UUID | None:
    """Parse cursor for admin listing."""
    if value is None or value == "":
        return None
    try:
        payload = _decode_cursor(value)
        return UUID(payload["id"])
    except (ValueError, KeyError, TypeError) as exc:
        raise ValidationError("Invalid cursor", field="cursor") from exc


def encode_cursor(value: Any) -> str:
    """Encode admin cursor."""
    payload = json.dumps({"id": str(value)}).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("utf-8")
    return encoded.rstrip("=")


def _decode_cursor(cursor: str) -> dict[str, Any]:
    """Decode admin cursor."""
    padding = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(cursor + padding)
    return json.loads(raw)
