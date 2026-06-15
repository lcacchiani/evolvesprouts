"""Strict consultation grid validation on public reservations."""

from __future__ import annotations

from typing import Any

import pytest

from app.api.public_reservations_intro_call import _assert_consultation_start_grid_aligned
from app.exceptions import ValidationError


def test_rejects_non_grid_primary_time() -> None:
    payload: dict[str, Any] = {
        "primary_session_start_iso": "2026-05-18T01:30:00Z",
        "session_slots": [],
    }
    with pytest.raises(ValidationError) as ei:
        _assert_consultation_start_grid_aligned(payload)
    assert ei.value.field == "primarySessionStartIso"


def test_rejects_weekend_primary() -> None:
    payload: dict[str, Any] = {
        "primary_session_start_iso": "2026-05-17T01:00:00Z",
        "session_slots": [],
    }
    with pytest.raises(ValidationError):
        _assert_consultation_start_grid_aligned(payload)


def test_rejects_malformed_primary_iso() -> None:
    payload: dict[str, Any] = {
        "primary_session_start_iso": "not-a-date",
        "session_slots": [],
    }
    with pytest.raises(ValidationError) as ei:
        _assert_consultation_start_grid_aligned(payload)
    assert ei.value.field == "primarySessionStartIso"
    assert ei.value.message == "Invalid timestamp"


def test_accepts_monday_am_grid() -> None:
    payload: dict[str, Any] = {
        "primary_session_start_iso": "2026-05-18T01:00:00Z",
        "session_slots": [],
    }
    _assert_consultation_start_grid_aligned(payload)


def test_rejects_session_slot_mismatch() -> None:
    payload: dict[str, Any] = {
        "primary_session_start_iso": "2026-05-18T01:00:00Z",
        "session_slots": [
            {"start_iso": "2026-05-18T02:30:00Z", "end_iso": "2026-05-18T03:30:00Z"}
        ],
    }
    with pytest.raises(ValidationError) as ei:
        _assert_consultation_start_grid_aligned(payload)
    assert "sessionSlots[0]" in str(ei.value.field)
