"""Intro-call availability with busy intervals patched (no database)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

import pytest

from app.services.intro_call_slots import (
    compute_available_intro_call_slots,
    is_intro_call_slot_available,
)


@pytest.fixture
def fake_session() -> object:
    return object()


def test_compute_subtracts_busy_union(fake_session: object) -> None:
    now = datetime(2026, 5, 4, 0, 0, tzinfo=UTC)
    from_d = date(2026, 5, 4)
    to_d = date(2026, 5, 4)
    am_block = (
        datetime(2026, 5, 3, 17, 0, tzinfo=UTC),
        datetime(2026, 5, 4, 4, 0, tzinfo=UTC),
    )
    with patch(
        "app.services.intro_call_slots.busy_intervals_utc",
        return_value=[am_block],
    ):
        slots = compute_available_intro_call_slots(
            fake_session, from_date=from_d, to_date=to_d, now=now
        )
    assert slots
    for s0, s1 in slots:
        assert not (s0 < am_block[1] and s1 > am_block[0])


def test_is_intro_call_slot_available_false_when_overlap(fake_session: object) -> None:
    now = datetime(2026, 5, 4, 0, 0, tzinfo=UTC)
    slot_start = datetime(2026, 5, 4, 1, 0, tzinfo=UTC)
    slot_end = slot_start + timedelta(minutes=15)
    overlap = (slot_start - timedelta(minutes=5), slot_end)
    with (
        patch(
            "app.services.intro_call_slots.busy_intervals_utc",
            return_value=[overlap],
        ),
        patch(
            "app.services.intro_call_slots.intro_call_instance_busy_intervals_utc",
            return_value=[],
        ),
    ):
        ok = is_intro_call_slot_available(
            fake_session,
            start_utc=slot_start,
            end_utc=slot_end,
            now=now,
        )
    assert ok is False


def test_exclude_intro_booking_interval_excludes_existing(fake_session: object) -> None:
    now = datetime(2026, 5, 4, 0, 0, tzinfo=UTC)
    slot_start = datetime(2026, 5, 4, 2, 0, tzinfo=UTC)
    slot_end = slot_start + timedelta(minutes=15)
    with (
        patch(
            "app.services.intro_call_slots.busy_intervals_utc",
            return_value=[],
        ),
        patch(
            "app.services.intro_call_slots.intro_call_instance_busy_intervals_utc",
            return_value=[(slot_start, slot_end)],
        ),
    ):
        ok = is_intro_call_slot_available(
            fake_session,
            start_utc=slot_start,
            end_utc=slot_end,
            now=now,
            exclude_intro_booking_interval=(slot_start, slot_end),
        )
    assert ok is True
