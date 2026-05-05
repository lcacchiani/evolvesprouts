"""Intro-call slot generation and availability (Asia/Hong_Kong office hours).

Candidate starts use a 30-minute cadence; each bookable interval is 15 minutes long.
"""

from __future__ import annotations

import os
from bisect import bisect_left
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    Contact,
    Enrollment,
    InstanceSessionSlot,
    Service,
    ServiceInstance,
)
from app.db.repositories.service_instance import (
    public_calendar_blocker_instance_predicates,
)
from app.db.models.calendar_manual_block import CalendarManualBlock
from app.services.calendar_blockers import (
    _AM_END_HOUR,
    _AM_START_HOUR,
    _PM_END_HOUR,
    _PM_START_HOUR,
    _intervals_overlap,
    _window_utc_for_local_hours,
    resolve_calendar_blockers_wall_timezone,
    select_public_calendar_blocker_session_slots,
)

_ENV_INTRO_CALL_WALL_TIMEZONE = "INTRO_CALL_WALL_TIMEZONE"
_INTRO_CALL_WALL_TIMEZONE_DEFAULT = "Asia/Hong_Kong"
_INTRO_CALL_OPEN_HOUR = 9
_INTRO_CALL_CLOSE_HOUR = 18
_INTRO_CALL_OPEN_DAYS: frozenset[int] = frozenset({0, 1, 2, 3, 4})
_INTRO_CALL_SLOT_STEP_MINUTES = 30
_INTRO_CALL_SLOT_DURATION_MINUTES = 15
_INTRO_CALL_LEAD_HOURS = 2
_INTRO_CALL_HORIZON_DAYS = 21
_INTRO_CALL_PURPOSE = "intro_call_booking"
_INTRO_CALL_INSTANCE_SLUG = "intro-call-free-15min"

_MANUAL_BLOCK_PURPOSES: frozenset[str] = frozenset(
    {"consultation_booking", _INTRO_CALL_PURPOSE}
)


def intro_call_purpose() -> str:
    return _INTRO_CALL_PURPOSE


def resolve_intro_call_wall_timezone() -> str:
    raw = os.getenv(_ENV_INTRO_CALL_WALL_TIMEZONE, "").strip()
    return raw or _INTRO_CALL_WALL_TIMEZONE_DEFAULT


def intro_call_window(*, now: datetime) -> tuple[date, date]:
    """Return inclusive ``(from_date, to_date)`` in wall zone for the product horizon."""
    zone = ZoneInfo(resolve_intro_call_wall_timezone())
    now_u = now if now.tzinfo else now.replace(tzinfo=UTC)
    today = now_u.astimezone(zone).date()
    return today, today + timedelta(days=_INTRO_CALL_HORIZON_DAYS)


def _slot_step() -> timedelta:
    return timedelta(minutes=_INTRO_CALL_SLOT_STEP_MINUTES)


def _slot_duration() -> timedelta:
    return timedelta(minutes=_INTRO_CALL_SLOT_DURATION_MINUTES)


def _lead_delta() -> timedelta:
    return timedelta(hours=_INTRO_CALL_LEAD_HOURS)


def enumerate_intro_call_candidate_slots(
    from_date: date,
    to_date: date,
    *,
    now: datetime,
) -> list[tuple[datetime, datetime]]:
    """Enumerate UTC instants for each candidate start in the weekly template."""
    zone = ZoneInfo(resolve_intro_call_wall_timezone())
    now_u = now if now.tzinfo else now.replace(tzinfo=UTC)
    earliest_start = now_u + _lead_delta()
    step = _slot_step()
    duration = _slot_duration()
    out: list[tuple[datetime, datetime]] = []
    cur = from_date
    while cur <= to_date:
        if cur.weekday() not in _INTRO_CALL_OPEN_DAYS:
            cur += timedelta(days=1)
            continue
        day_start = datetime.combine(
            cur,
            time(hour=_INTRO_CALL_OPEN_HOUR, minute=0),
            tzinfo=zone,
        )
        open_minutes = _INTRO_CALL_OPEN_HOUR * 60
        close_minutes = _INTRO_CALL_CLOSE_HOUR * 60
        max_start_minutes = close_minutes - _INTRO_CALL_SLOT_DURATION_MINUTES
        step_m = _INTRO_CALL_SLOT_STEP_MINUTES
        last_start_minute_of_day = (
            open_minutes + ((max_start_minutes - open_minutes) // step_m) * step_m
        )
        last_start = day_start + timedelta(
            minutes=last_start_minute_of_day - open_minutes
        )
        t = day_start
        while t <= last_start:
            start_utc = t.astimezone(UTC)
            end_utc = (t + duration).astimezone(UTC)
            if end_utc > now_u and start_utc >= earliest_start:
                out.append((start_utc, end_utc))
            t += step
        cur += timedelta(days=1)
    out.sort(key=lambda x: x[0])
    return out


def _manual_block_busy_intervals_utc(
    session: Session,
    *,
    from_date: date,
    to_date: date,
) -> list[tuple[datetime, datetime]]:
    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    rows = session.execute(
        select(CalendarManualBlock.block_date, CalendarManualBlock.period).where(
            CalendarManualBlock.purpose.in_(_MANUAL_BLOCK_PURPOSES),
            CalendarManualBlock.block_date >= from_date,
            CalendarManualBlock.block_date <= to_date,
        )
    ).all()
    intervals: list[tuple[datetime, datetime]] = []
    for block_date, period in rows:
        ymd = block_date.isoformat()
        if period in ("am", "both"):
            win = _window_utc_for_local_hours(
                ymd,
                start_hour=_AM_START_HOUR,
                end_hour=_AM_END_HOUR,
                zone=zone,
            )
            if win:
                intervals.append(win)
        if period in ("pm", "both"):
            win = _window_utc_for_local_hours(
                ymd,
                start_hour=_PM_START_HOUR,
                end_hour=_PM_END_HOUR,
                zone=zone,
            )
            if win:
                intervals.append(win)
    return intervals


def _session_blocker_busy_intervals_utc(
    session: Session,
    *,
    range_start_utc: datetime,
    range_end_utc: datetime,
) -> list[tuple[datetime, datetime]]:
    slot_stmt = select_public_calendar_blocker_session_slots(
        range_start_utc=range_start_utc,
        range_end_utc=range_end_utc,
    )
    out: list[tuple[datetime, datetime]] = []
    for starts_at, ends_at in session.execute(slot_stmt).all():
        if starts_at is None or ends_at is None:
            continue
        s0 = starts_at if starts_at.tzinfo else starts_at.replace(tzinfo=UTC)
        s1 = ends_at if ends_at.tzinfo else ends_at.replace(tzinfo=UTC)
        out.append((s0, s1))
    return out


def _non_intro_session_busy_intervals_utc(
    session: Session,
    *,
    range_start_utc: datetime,
    range_end_utc: datetime,
) -> list[tuple[datetime, datetime]]:
    stmt = (
        select(InstanceSessionSlot.starts_at, InstanceSessionSlot.ends_at)
        .join(ServiceInstance, InstanceSessionSlot.instance_id == ServiceInstance.id)
        .join(Service, ServiceInstance.service_id == Service.id)
        .where(
            InstanceSessionSlot.starts_at < range_end_utc,
            InstanceSessionSlot.ends_at > range_start_utc,
            ServiceInstance.slug != _INTRO_CALL_INSTANCE_SLUG,
            *public_calendar_blocker_instance_predicates(),
        )
    )
    out: list[tuple[datetime, datetime]] = []
    for starts_at, ends_at in session.execute(stmt).all():
        if starts_at is None or ends_at is None:
            continue
        s0 = starts_at if starts_at.tzinfo else starts_at.replace(tzinfo=UTC)
        s1 = ends_at if ends_at.tzinfo else ends_at.replace(tzinfo=UTC)
        out.append((s0, s1))
    return out


def _intro_instance_busy_intervals_utc(
    session: Session,
    *,
    range_start_utc: datetime,
    range_end_utc: datetime,
) -> list[tuple[datetime, datetime]]:
    stmt = (
        select(InstanceSessionSlot.starts_at, InstanceSessionSlot.ends_at)
        .join(ServiceInstance, InstanceSessionSlot.instance_id == ServiceInstance.id)
        .where(
            ServiceInstance.slug == _INTRO_CALL_INSTANCE_SLUG,
            InstanceSessionSlot.starts_at < range_end_utc,
            InstanceSessionSlot.ends_at > range_start_utc,
        )
    )
    out: list[tuple[datetime, datetime]] = []
    for starts_at, ends_at in session.execute(stmt).all():
        if starts_at is None or ends_at is None:
            continue
        s0 = starts_at if starts_at.tzinfo else starts_at.replace(tzinfo=UTC)
        s1 = ends_at if ends_at.tzinfo else ends_at.replace(tzinfo=UTC)
        out.append((s0, s1))
    return out


def _merge_busy_intervals(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []
    sorted_iv = sorted(intervals, key=lambda x: x[0])
    merged: list[tuple[datetime, datetime]] = [sorted_iv[0]]
    for a0, a1 in sorted_iv[1:]:
        b0, b1 = merged[-1]
        if a0 <= b1:
            merged[-1] = (b0, max(b1, a1))
        else:
            merged.append((a0, a1))
    return merged


def _candidate_blocked(
    start_utc: datetime,
    end_utc: datetime,
    busy_merged: list[tuple[datetime, datetime]],
) -> bool:
    if not busy_merged:
        return False
    starts = [b[0] for b in busy_merged]
    i = bisect_left(starts, end_utc)
    for j in (i - 1, i):
        if 0 <= j < len(busy_merged):
            b0, b1 = busy_merged[j]
            if _intervals_overlap(start_utc, end_utc, b0, b1):
                return True
    return False


def compute_available_intro_call_slots(
    session: Session,
    *,
    from_date: date,
    to_date: date,
    now: datetime,
) -> list[tuple[datetime, datetime]]:
    candidates = enumerate_intro_call_candidate_slots(from_date, to_date, now=now)
    if not candidates:
        return []
    now_u = now if now.tzinfo else now.replace(tzinfo=UTC)
    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    range_start_local = datetime.combine(from_date, time.min, tzinfo=zone)
    range_end_local = datetime.combine(to_date, time.max, tzinfo=zone)
    range_start_utc = range_start_local.astimezone(UTC)
    range_end_utc = range_end_local.astimezone(UTC)
    busy: list[tuple[datetime, datetime]] = []
    busy.extend(
        _manual_block_busy_intervals_utc(session, from_date=from_date, to_date=to_date)
    )
    busy.extend(
        _session_blocker_busy_intervals_utc(
            session, range_start_utc=range_start_utc, range_end_utc=range_end_utc
        )
    )
    busy.extend(
        _non_intro_session_busy_intervals_utc(
            session, range_start_utc=range_start_utc, range_end_utc=range_end_utc
        )
    )
    busy.extend(
        _intro_instance_busy_intervals_utc(
            session, range_start_utc=range_start_utc, range_end_utc=range_end_utc
        )
    )
    busy_merged = _merge_busy_intervals(busy)
    return [
        (s0, s1)
        for s0, s1 in candidates
        if not _candidate_blocked(s0, s1, busy_merged) and s1 > now_u
    ]


def _norm_utc_pair(start_utc: datetime, end_utc: datetime) -> tuple[datetime, datetime]:
    s0 = start_utc if start_utc.tzinfo else start_utc.replace(tzinfo=UTC)
    s1 = end_utc if end_utc.tzinfo else end_utc.replace(tzinfo=UTC)
    return (s0.astimezone(UTC), s1.astimezone(UTC))


def is_intro_call_slot_available(
    session: Session,
    *,
    start_utc: datetime,
    end_utc: datetime,
    now: datetime | None = None,
    ignore_intro_slot: tuple[datetime, datetime] | None = None,
) -> bool:
    """True if the proposed UTC interval does not conflict with busy time.

    ``ignore_intro_slot`` excludes one intro instance interval (e.g. the row
    being validated inside a transaction before insert).
    """
    now_u = (
        datetime.now(tz=UTC)
        if now is None
        else (now if now.tzinfo else now.replace(tzinfo=UTC))
    )
    s0, s1 = _norm_utc_pair(start_utc, end_utc)
    if s1 <= s0:
        return False
    zone = ZoneInfo(resolve_intro_call_wall_timezone())
    day_local = s0.astimezone(zone).date()
    from_d = day_local - timedelta(days=1)
    to_d = day_local + timedelta(days=1)
    candidates = enumerate_intro_call_candidate_slots(from_d, to_d, now=now_u)
    cand_set = {_norm_utc_pair(a, b) for a, b in candidates}
    if (s0, s1) not in cand_set:
        return False
    range_start_utc = s0 - timedelta(days=1)
    range_end_utc = s1 + timedelta(days=1)
    busy: list[tuple[datetime, datetime]] = []
    busy.extend(
        _manual_block_busy_intervals_utc(session, from_date=from_d, to_date=to_d)
    )
    busy.extend(
        _session_blocker_busy_intervals_utc(
            session, range_start_utc=range_start_utc, range_end_utc=range_end_utc
        )
    )
    busy.extend(
        _non_intro_session_busy_intervals_utc(
            session, range_start_utc=range_start_utc, range_end_utc=range_end_utc
        )
    )
    ign = _norm_utc_pair(*ignore_intro_slot) if ignore_intro_slot else None
    for b0, b1 in _intro_instance_busy_intervals_utc(
        session, range_start_utc=range_start_utc, range_end_utc=range_end_utc
    ):
        if ign is not None and _norm_utc_pair(b0, b1) == ign:
            continue
        busy.append((b0, b1))
    busy_merged = _merge_busy_intervals(busy)
    return not _candidate_blocked(s0, s1, busy_merged)


def recent_intro_call_enrollment_last_booked_at(
    session: Session,
    *,
    email_lower: str,
    within_days: int = 30,
    now: datetime,
) -> datetime | None:
    """Latest ``Enrollment.updated_at`` for intro-call instance + normalized email.

    Rebook flows reuse the same enrollment row; ``updated_at`` is bumped after each
    successful slot booking so the rolling cooldown reflects the last booking time.

    ``within_days`` documents the cooldown window for callers; the query returns
    the enrollment timestamp regardless of age so callers can apply a rolling window
    from ``updated_at``.
    """
    _ = within_days, now
    em = email_lower.strip().lower()
    stmt = (
        select(Enrollment.updated_at)
        .join(Contact, Enrollment.contact_id == Contact.id)
        .join(ServiceInstance, Enrollment.instance_id == ServiceInstance.id)
        .where(
            ServiceInstance.slug == _INTRO_CALL_INSTANCE_SLUG,
            Contact.email.isnot(None),
            func.lower(Contact.email) == em,
        )
        .order_by(Enrollment.updated_at.desc())
        .limit(1)
    )
    return session.execute(stmt).scalar_one_or_none()


def intro_call_cooldown_blocks_from_last_booked_at(
    *,
    prior_last_booked_at: datetime,
    now: datetime,
    cooldown_days: int = 30,
) -> bool:
    """True when ``now`` is still within ``cooldown_days`` after ``prior_last_booked_at``."""
    now_u = now if now.tzinfo else now.replace(tzinfo=UTC)
    start_u = (
        prior_last_booked_at
        if prior_last_booked_at.tzinfo
        else prior_last_booked_at.replace(tzinfo=UTC)
    )
    return now_u < start_u.astimezone(UTC) + timedelta(days=cooldown_days)
