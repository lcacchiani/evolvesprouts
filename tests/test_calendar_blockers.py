"""Tests for calendar blocker merge, reservation checks, and classification."""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models.calendar_manual_block import CalendarManualBlock
from app.exceptions import ValidationError
from app.services.calendar_blockers import (
    classify_consultation_start_local_half_day,
    consultation_booking_purpose,
    is_consultation_half_day_blocked,
    merge_calendar_blockers_for_purpose,
    raise_if_consultation_reservation_blocked,
    validate_session_slot_chronology,
)


def test_classify_am_accepts_non_zero_minute_same_day() -> None:
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


def test_validate_session_slot_chronology_end_before_start() -> None:
    assert (
        validate_session_slot_chronology(
            [
                {
                    "start_iso": "2026-04-07T10:00:00+08:00",
                    "end_iso": "2026-04-07T09:00:00+08:00",
                },
            ]
        )
        == "session_slot_end_before_start"
    )


def test_validate_session_slot_chronology_invalid_iso() -> None:
    assert (
        validate_session_slot_chronology(
            [{"start_iso": "not-iso", "end_iso": "2026-04-07T11:00:00+08:00"}]
        )
        == "invalid_session_slot_iso"
    )


def test_validate_session_slot_chronology_ok() -> None:
    assert (
        validate_session_slot_chronology(
            [
                {
                    "start_iso": "2026-04-07T10:00:00+08:00",
                    "end_iso": "2026-04-07T11:00:00+08:00",
                },
            ]
        )
        is None
    )


def test_raise_if_consultation_reservation_blocked_multi_slot_second_blocked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MagicMock()

    def fake_half_day(
        s: Session,
        *,
        purpose: str,
        day_local: date,
        period: str,
    ) -> bool:
        _ = s, purpose
        return day_local == date(2026, 4, 10) and period == "am"

    session.__class__ = Session

    monkeypatch.setattr(
        "app.services.calendar_blockers.is_consultation_half_day_blocked",
        fake_half_day,
    )
    with pytest.raises(ValidationError) as exc:
        raise_if_consultation_reservation_blocked(
            session=session,  # type: ignore[arg-type]
            purpose=consultation_booking_purpose(),
            primary_start_iso="2026-04-07T10:00:00+08:00",
            session_slots=[
                {
                    "start_iso": "2026-04-10T10:00:00+08:00",
                    "end_iso": "2026-04-10T11:00:00+08:00",
                },
            ],
        )
    assert exc.value.field == "sessionSlots[0].startIso"


def test_raise_if_consultation_reservation_blocked_primary_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MagicMock()

    def fake_half_day(
        s: Session,
        *,
        purpose: str,
        day_local: date,
        period: str,
    ) -> bool:
        _ = s, purpose
        return day_local == date(2026, 4, 7) and period == "pm"

    monkeypatch.setattr(
        "app.services.calendar_blockers.is_consultation_half_day_blocked",
        fake_half_day,
    )
    with pytest.raises(ValidationError) as exc:
        raise_if_consultation_reservation_blocked(
            session=session,  # type: ignore[arg-type]
            purpose=consultation_booking_purpose(),
            primary_start_iso="2026-04-07T15:00:00+08:00",
            session_slots=None,
        )
    assert exc.value.field == "primarySessionStartIso"


def test_is_consultation_half_day_blocked_manual_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.calendar_blockers._session_blocks_half_day",
        lambda *a, **k: False,
    )
    engine = create_engine("sqlite:///:memory:")
    CalendarManualBlock.__table__.create(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    purpose = consultation_booking_purpose()
    now = datetime.now(tz=UTC)
    with SessionLocal() as session:
        session.add(
            CalendarManualBlock(
                id=uuid4(),
                purpose=purpose,
                block_date=date(2026, 5, 1),
                period="am",
                note=None,
                created_by=None,
                updated_by=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    with SessionLocal() as session:
        assert is_consultation_half_day_blocked(
            session, purpose=purpose, day_local=date(2026, 5, 1), period="am"
        )
        assert not is_consultation_half_day_blocked(
            session, purpose=purpose, day_local=date(2026, 5, 1), period="pm"
        )


def test_is_consultation_half_day_blocked_session_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MagicMock()
    monkeypatch.setattr(
        "app.services.calendar_blockers._manual_block_exists_for_half_day",
        lambda *a, **k: False,
    )
    monkeypatch.setattr(
        "app.services.calendar_blockers._session_blocks_half_day",
        lambda *a, **k: True,
    )
    assert is_consultation_half_day_blocked(
        session,  # type: ignore[arg-type]
        purpose=consultation_booking_purpose(),
        day_local=date(2026, 5, 1),
        period="pm",
    )


def test_is_consultation_half_day_blocked_both_manual_and_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MagicMock()
    monkeypatch.setattr(
        "app.services.calendar_blockers._manual_block_exists_for_half_day",
        lambda *a, **k: True,
    )
    monkeypatch.setattr(
        "app.services.calendar_blockers._session_blocks_half_day",
        lambda *a, **k: True,
    )
    assert is_consultation_half_day_blocked(
        session,  # type: ignore[arg-type]
        purpose=consultation_booking_purpose(),
        day_local=date(2026, 5, 1),
        period="am",
    )


def test_is_consultation_half_day_blocked_neither(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MagicMock()
    monkeypatch.setattr(
        "app.services.calendar_blockers._manual_block_exists_for_half_day",
        lambda *a, **k: False,
    )
    monkeypatch.setattr(
        "app.services.calendar_blockers._session_blocks_half_day",
        lambda *a, **k: False,
    )
    assert not is_consultation_half_day_blocked(
        session,  # type: ignore[arg-type]
        purpose=consultation_booking_purpose(),
        day_local=date(2026, 5, 1),
        period="am",
    )


def test_merge_calendar_blockers_range_includes_boundary_manual(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy import false, literal, select as sa_select

    def _empty_slots(**_kwargs: object) -> object:
        return sa_select(literal(None), literal(None)).where(false())

    monkeypatch.setattr(
        "app.services.calendar_blockers.select_public_calendar_blocker_session_slots",
        _empty_slots,
    )
    engine = create_engine("sqlite:///:memory:")
    CalendarManualBlock.__table__.create(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    purpose = consultation_booking_purpose()
    d0 = date(2026, 6, 1)
    d1 = date(2026, 6, 3)
    now = datetime.now(tz=UTC)
    with SessionLocal() as session:
        session.add(
            CalendarManualBlock(
                id=uuid4(),
                purpose=purpose,
                block_date=d0,
                period="both",
                note=None,
                created_by=None,
                updated_by=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            CalendarManualBlock(
                id=uuid4(),
                purpose=purpose,
                block_date=d1,
                period="pm",
                note=None,
                created_by=None,
                updated_by=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    with SessionLocal() as session:
        out = merge_calendar_blockers_for_purpose(
            session, purpose=purpose, from_date=d0, to_date=d1
        )
    by_date = {row["date"]: row["period"] for row in out}
    assert by_date.get(d0.isoformat()) == "both"
    assert by_date.get(d1.isoformat()) == "pm"
