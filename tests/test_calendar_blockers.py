"""Tests for consultation calendar blocker classification and blocking."""

from __future__ import annotations

import pytest
from datetime import date

from app.exceptions import ValidationError
from app.services.calendar_blockers import (
    classify_consultation_start_local_half_day,
    consultation_booking_purpose,
)


def test_classify_am_accepts_non_zero_minute_same_day() -> None:
    """A4: hour-based AM classification (not tied to 09:00:00 exactly)."""
    day, period = classify_consultation_start_local_half_day(
        start_iso="2026-04-07T09:30:00+08:00",
        wall_zone="Asia/Hong_Kong",
    )
    assert day == date(2026, 4, 7)
    assert period == "am"


def test_classify_pm_accepts_14_15() -> None:
    day, period = classify_consultation_start_local_half_day(
        start_iso="2026-04-07T14:15:00+08:00",
        wall_zone="Asia/Hong_Kong",
    )
    assert day == date(2026, 4, 7)
    assert period == "pm"


def test_classify_noon_gap_raises_400() -> None:
    with pytest.raises(ValidationError) as exc:
        classify_consultation_start_local_half_day(
            start_iso="2026-04-07T12:30:00+08:00",
            wall_zone="Asia/Hong_Kong",
            field="primarySessionStartIso",
        )
    assert exc.value.field == "primarySessionStartIso"


def test_classify_invalid_iso_raises() -> None:
    with pytest.raises(ValidationError):
        classify_consultation_start_local_half_day(
            start_iso="not-a-date",
            field="sessionSlots[0].startIso",
        )


def test_purpose_constant() -> None:
    assert consultation_booking_purpose() == "consultation_booking"
