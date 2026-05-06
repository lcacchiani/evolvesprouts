"""Manual calendar block purpose scoping for availability busy intervals (H1)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models.calendar_manual_block import CalendarManualBlock
from app.services.calendar_blockers import (
    compute_available_consultation_slots,
    consultation_booking_purpose,
)
from app.services.intro_call_slots import (
    compute_available_intro_call_slots,
    intro_call_purpose,
)
from app.services.public_calendar_availability import (
    merge_intervals_union,
    _manual_calendar_busy_intervals_utc,
)


def test_manual_query_filters_by_purpose_parameter() -> None:
    engine = create_engine("sqlite:///:memory:")
    CalendarManualBlock.__table__.create(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime.now(tz=UTC)
    d = date(2030, 6, 10)
    with SessionLocal() as session:
        session.add(
            CalendarManualBlock(
                id=uuid4(),
                purpose=intro_call_purpose(),
                block_date=d,
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
        intro_only = _manual_calendar_busy_intervals_utc(
            session,
            from_date=d,
            to_date=d,
            purposes=frozenset({intro_call_purpose()}),
        )
        consult_only = _manual_calendar_busy_intervals_utc(
            session,
            from_date=d,
            to_date=d,
            purposes=frozenset({consultation_booking_purpose()}),
        )
    assert intro_only
    assert consult_only == []


def test_consultation_compute_passes_consultation_only_manual_purposes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[frozenset[str]] = []

    def wrap(*args: object, **kwargs: object) -> list:
        mb = kwargs.get("manual_block_purposes")
        assert isinstance(mb, frozenset)
        seen.append(mb)
        return []

    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc",
        wrap,
    )
    compute_available_consultation_slots(
        object(),
        from_date=date(2030, 6, 10),
        to_date=date(2030, 6, 10),
        now=datetime(2030, 1, 1, tzinfo=UTC),
    )
    assert seen == [frozenset({consultation_booking_purpose()})]


def test_intro_compute_passes_both_manual_purposes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[frozenset[str]] = []

    def wrap(*args: object, **kwargs: object) -> list:
        mb = kwargs.get("manual_block_purposes")
        assert isinstance(mb, frozenset)
        seen.append(mb)
        return []

    monkeypatch.setattr(
        "app.services.intro_call_slots.busy_intervals_utc",
        wrap,
    )
    compute_available_intro_call_slots(
        object(),
        from_date=date(2030, 6, 10),
        to_date=date(2030, 6, 10),
        now=datetime(2030, 1, 1, tzinfo=UTC),
    )
    assert seen == [
        frozenset({consultation_booking_purpose(), intro_call_purpose()}),
    ]


def test_intro_manual_block_does_not_remove_consultation_am_candidate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Intro-only manual AM block must not suppress consultation half-day slots (H1)."""
    engine = create_engine("sqlite:///:memory:")
    CalendarManualBlock.__table__.create(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime.now(tz=UTC)
    monday = date(2030, 6, 10)
    assert monday.weekday() == 0
    with SessionLocal() as session:
        session.add(
            CalendarManualBlock(
                id=uuid4(),
                purpose=intro_call_purpose(),
                block_date=monday,
                period="am",
                note=None,
                created_by=None,
                updated_by=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    def thin_busy(session_obj: object, **kwargs: object) -> list:
        purposes = kwargs["manual_block_purposes"]
        rs = kwargs["range_start_utc"]
        re = kwargs["range_end_utc"]
        from app.services.calendar_blockers import (
            resolve_calendar_blockers_wall_timezone,
        )
        from zoneinfo import ZoneInfo

        zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
        local_start = rs.astimezone(zone).date()
        local_end = re.astimezone(zone).date()
        manual_iv = _manual_calendar_busy_intervals_utc(
            session_obj,
            from_date=local_start,
            to_date=local_end,
            purposes=purposes,
        )
        return merge_intervals_union(manual_iv)

    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc", thin_busy
    )
    with SessionLocal() as session:
        slots = compute_available_consultation_slots(
            session,
            from_date=monday,
            to_date=monday,
            now=datetime(2030, 6, 1, 0, 0, tzinfo=UTC),
        )
    assert slots


def test_consultation_manual_block_blocks_consultation_am_and_intro_am(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite:///:memory:")
    CalendarManualBlock.__table__.create(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime.now(tz=UTC)
    monday = date(2030, 6, 10)
    with SessionLocal() as session:
        session.add(
            CalendarManualBlock(
                id=uuid4(),
                purpose=consultation_booking_purpose(),
                block_date=monday,
                period="am",
                note=None,
                created_by=None,
                updated_by=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    def thin_busy(session_obj: object, **kwargs: object) -> list:
        purposes = kwargs["manual_block_purposes"]
        rs = kwargs["range_start_utc"]
        re = kwargs["range_end_utc"]
        from app.services.calendar_blockers import (
            resolve_calendar_blockers_wall_timezone,
        )
        from zoneinfo import ZoneInfo

        zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
        local_start = rs.astimezone(zone).date()
        local_end = re.astimezone(zone).date()
        manual_iv = _manual_calendar_busy_intervals_utc(
            session_obj,
            from_date=local_start,
            to_date=local_end,
            purposes=purposes,
        )
        return merge_intervals_union(manual_iv)

    monkeypatch.setattr(
        "app.services.public_calendar_availability.busy_intervals_utc", thin_busy
    )
    with SessionLocal() as session:
        consult_slots = compute_available_consultation_slots(
            session,
            from_date=monday,
            to_date=monday,
            now=datetime(2030, 6, 1, 0, 0, tzinfo=UTC),
        )
    am_starts_utc_hour = [s[0].hour for s in consult_slots]
    assert 1 not in am_starts_utc_hour

    monkeypatch.setattr("app.services.intro_call_slots.busy_intervals_utc", thin_busy)
    with SessionLocal() as session:
        intro_slots = compute_available_intro_call_slots(
            session,
            from_date=monday,
            to_date=monday,
            now=datetime(2030, 6, 1, 0, 0, tzinfo=UTC),
        )
    assert not any(s[0].hour == 1 and s[0].minute == 0 for s in intro_slots)
