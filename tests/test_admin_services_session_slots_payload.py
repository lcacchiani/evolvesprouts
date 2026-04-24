"""Tests for session slot datetime parsing on admin instance payloads."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.api.admin_services_payload_utils import parse_session_slots
from app.exceptions import ValidationError


def test_parse_session_slots_accepts_z_suffix() -> None:
    slots = parse_session_slots(
        [
            {
                "starts_at": "2026-06-10T09:15:00Z",
                "ends_at": "2026-06-10T11:15:00Z",
                "sort_order": 0,
            }
        ]
    )
    assert len(slots) == 1
    assert slots[0]["starts_at"] == datetime(2026, 6, 10, 9, 15, tzinfo=UTC)
    assert slots[0]["ends_at"] == datetime(2026, 6, 10, 11, 15, tzinfo=UTC)


def test_parse_session_slots_accepts_numeric_offset() -> None:
    slots = parse_session_slots(
        [
            {
                "starts_at": "2026-06-10T17:15:00+08:00",
                "ends_at": "2026-06-10T19:15:00+08:00",
            }
        ]
    )
    assert slots[0]["starts_at"] == datetime(2026, 6, 10, 9, 15, tzinfo=UTC)
    assert slots[0]["ends_at"] == datetime(2026, 6, 10, 11, 15, tzinfo=UTC)


def test_parse_session_slots_rejects_naive_datetime() -> None:
    with pytest.raises(ValidationError) as exc:
        parse_session_slots(
            [
                {
                    "starts_at": "2026-06-10T09:15",
                    "ends_at": "2026-06-10T11:15",
                }
            ]
        )
    assert exc.value.field == "session_slots[0].starts_at"


def test_parse_session_slots_rejects_ends_before_starts() -> None:
    with pytest.raises(ValidationError) as exc:
        parse_session_slots(
            [
                {
                    "starts_at": "2026-06-10T12:00:00Z",
                    "ends_at": "2026-06-10T11:00:00Z",
                }
            ]
        )
    assert exc.value.field == "session_slots"
