"""Unit tests for intro-call candidate slot enumeration."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.services.intro_call_slots import (
    _INTRO_CALL_HORIZON_DAYS,
    enumerate_intro_call_candidate_slots,
    intro_call_window,
)


def test_enumerate_weekday_only_and_half_hour_grid() -> None:
    # Monday 2026-05-04 HKT; anchor ``now`` on the prior weekend so the 2h lead
    # does not clip the first 09:00 slot.
    now = datetime(2026, 5, 3, 0, 0, tzinfo=UTC)
    slots = enumerate_intro_call_candidate_slots(
        date(2026, 5, 4), date(2026, 5, 4), now=now
    )
    assert len(slots) == 18
    for s0, s1 in slots:
        assert (s1 - s0).total_seconds() == 15 * 60
    assert slots[0][0].hour in (0, 1)  # 09:00 HKT -> UTC


def test_weekend_skipped() -> None:
    now = datetime(2026, 5, 2, 0, 0, tzinfo=UTC)  # Saturday
    slots = enumerate_intro_call_candidate_slots(
        date(2026, 5, 2), date(2026, 5, 3), now=now
    )
    assert slots == []


def test_lead_time_floor() -> None:
    # Monday 10:00 UTC — lead 2h means first slot start >= 12:00 UTC if we use now=10:00 UTC
    now = datetime(2026, 5, 4, 10, 0, tzinfo=UTC)
    slots = enumerate_intro_call_candidate_slots(
        date(2026, 5, 4), date(2026, 5, 4), now=now
    )
    assert all(s0 >= now + timedelta(hours=2) for s0, _ in slots)


def test_horizon_intro_call_window() -> None:
    now = datetime(2026, 5, 4, 8, 0, tzinfo=UTC)
    d0, d1 = intro_call_window(now=now)
    assert (d1 - d0).days == _INTRO_CALL_HORIZON_DAYS


def test_month_boundary() -> None:
    now = datetime(2026, 4, 28, 0, 0, tzinfo=UTC)
    slots = enumerate_intro_call_candidate_slots(
        date(2026, 4, 28), date(2026, 5, 5), now=now
    )
    assert slots
    assert slots == sorted(slots, key=lambda x: x[0])


def test_last_candidate_start_is_close_hour_minus_duration_on_grid() -> None:
    """Last start must end before close; grid derived from step, not a hardcoded :30."""
    from zoneinfo import ZoneInfo

    now = datetime(2026, 5, 3, 0, 0, tzinfo=UTC)
    slots = enumerate_intro_call_candidate_slots(
        date(2026, 5, 4), date(2026, 5, 4), now=now
    )
    assert slots
    zone = ZoneInfo("Asia/Hong_Kong")
    last_s0, last_s1 = slots[-1]
    assert last_s0.astimezone(zone).strftime("%H:%M") == "17:30"
    assert last_s1.astimezone(zone).strftime("%H:%M") == "17:45"
