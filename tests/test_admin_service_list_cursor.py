"""Tests for service list pagination cursor (title + id)."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.api.admin_services_cursor import encode_service_list_cursor, parse_service_list_cursor
from app.exceptions import ValidationError


def test_parse_service_list_cursor_round_trip() -> None:
    title = "Alpha Course"
    row_id = uuid4()
    token = encode_service_list_cursor(title, row_id)
    assert token is not None
    parsed_title, parsed_id = parse_service_list_cursor(token)
    assert parsed_title == title
    assert parsed_id == row_id


def test_parse_service_list_cursor_empty() -> None:
    assert parse_service_list_cursor(None) == (None, None)
    assert parse_service_list_cursor("") == (None, None)


def test_parse_service_list_cursor_rejects_legacy_created_cursor() -> None:
    """Previous API used created_at + id in the cursor payload."""
    payload = json.dumps(
        {
            "created_at": datetime(2026, 1, 1, tzinfo=UTC).isoformat(),
            "id": str(uuid4()),
        }
    ).encode("utf-8")
    token = base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")
    with pytest.raises(ValidationError):
        parse_service_list_cursor(token)
