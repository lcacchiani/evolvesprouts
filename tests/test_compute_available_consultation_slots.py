"""Unit tests for compute_available_consultation_slots."""

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.services.calendar_blockers import compute_available_consultation_slots


def test_weekend_dates_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc",
        lambda *_a, **_k: [],
    )
    slots = compute_available_consultation_slots(
        object(),
        from_date=date(2026, 5, 16),
        to_date=date(2026, 5, 17),
        now=datetime(2026, 5, 1, 0, 0, tzinfo=UTC),
    )
    assert slots == []


def test_lead_two_calendar_days(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc",
        lambda *_a, **_k: [],
    )
    # Local calendar date May 11 → first eligible calendar date May 13 (two calendar-day lead).
    now = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Hong_Kong")).astimezone(
        UTC
    )
    slots = compute_available_consultation_slots(
        object(),
        from_date=date(2026, 5, 11),
        to_date=date(2026, 5, 13),
        now=now,
    )
    starts = {s[0].astimezone(ZoneInfo("Asia/Hong_Kong")).date() for s in slots}
    assert date(2026, 5, 11) not in starts
    assert date(2026, 5, 12) not in starts
    assert date(2026, 5, 13) in starts


def test_am_pm_hkt_utc_insts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc",
        lambda *_a, **_k: [],
    )
    now = datetime(2026, 5, 1, 0, 0, tzinfo=UTC)
    slots = compute_available_consultation_slots(
        object(),
        from_date=date(2026, 5, 18),
        to_date=date(2026, 5, 18),
        now=now,
    )
    assert len(slots) == 2
    am, pm = sorted(slots, key=lambda x: x[0])
    assert am[0].strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-05-18T01:00:00Z"
    assert pm[0].strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-05-18T06:00:00Z"


def test_busy_overlap_drops_am(monkeypatch: pytest.MonkeyPatch) -> None:
    zone = ZoneInfo("Asia/Hong_Kong")
    day = date(2026, 5, 18)
    am_start = datetime(day.year, day.month, day.day, 9, 0, tzinfo=zone).astimezone(UTC)
    am_end = datetime(day.year, day.month, day.day, 12, 0, tzinfo=zone).astimezone(UTC)

    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc",
        lambda *_a, **_k: [(am_start, am_end)],
    )
    slots = compute_available_consultation_slots(
        object(),
        from_date=day,
        to_date=day,
        now=datetime(2026, 5, 1, 0, 0, tzinfo=UTC),
    )
    assert len(slots) == 1
    assert slots[0][0].hour == 6  # PM start UTC
