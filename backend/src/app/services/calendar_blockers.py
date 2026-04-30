"""Merge manual calendar blocks with session-derived half-day blockers."""

from __future__ import annotations

import os
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.calendar_manual_block import CalendarManualBlock
from app.db.repositories.service_instance import (
    select_public_calendar_blocker_session_slots,
)
from app.utils.logging import get_logger

logger = get_logger(__name__)

CalendarBlockPeriod = Literal["am", "pm", "both"]

_ENV_CALENDAR_BLOCKERS_WALL_TIMEZONE = "CALENDAR_BLOCKERS_WALL_TIMEZONE"
_DEFAULT_WALL_TIMEZONE = "Asia/Hong_Kong"

# Match public consultation picker nominal windows (local wall clock).
_AM_START_HOUR = 9
_AM_END_HOUR = 12
_PM_START_HOUR = 14
_PM_END_HOUR = 18

_PURPOSE_CONSULTATION_BOOKING = "consultation_booking"

_ALLOWED_PUBLIC_BLOCKER_PURPOSES: frozenset[str] = frozenset(
    {_PURPOSE_CONSULTATION_BOOKING}
)


def resolve_calendar_blockers_wall_timezone() -> str:
    raw = os.getenv(_ENV_CALENDAR_BLOCKERS_WALL_TIMEZONE, "").strip()
    return raw or _DEFAULT_WALL_TIMEZONE


def consultation_booking_purpose() -> str:
    return _PURPOSE_CONSULTATION_BOOKING


def is_public_blockers_purpose_allowed(purpose: str) -> bool:
    return purpose.strip().lower() in _ALLOWED_PUBLIC_BLOCKER_PURPOSES


def _ymd_in_zone(instant: datetime, zone: ZoneInfo) -> str:
    return instant.astimezone(zone).strftime("%Y-%m-%d")


def _window_utc_for_local_hours(
    ymd: str,
    *,
    start_hour: int,
    end_hour: int,
    zone: ZoneInfo,
) -> tuple[datetime, datetime] | None:
    try:
        y, m, d_part = (int(ymd[0:4]), int(ymd[5:7]), int(ymd[8:10]))
    except (TypeError, ValueError, IndexError):
        return None
    try:
        day_local = date(y, m, d_part)
    except ValueError:
        return None
    start_local = datetime.combine(
        day_local, time(hour=start_hour, minute=0), tzinfo=zone
    )
    end_local = datetime.combine(day_local, time(hour=end_hour, minute=0), tzinfo=zone)
    if end_local <= start_local:
        return None
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def _intervals_overlap(a0: datetime, a1: datetime, b0: datetime, b1: datetime) -> bool:
    return a0 < b1 and b0 < a1


def _merge_period_map(
    by_date: dict[str, dict[str, bool]],
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for ymd in sorted(by_date.keys()):
        row = by_date[ymd]
        am = bool(row.get("am"))
        pm = bool(row.get("pm"))
        if am and pm:
            out.append({"date": ymd, "period": "both"})
        elif am:
            out.append({"date": ymd, "period": "am"})
        elif pm:
            out.append({"date": ymd, "period": "pm"})
    return out


def _apply_period(
    by_date: dict[str, dict[str, bool]],
    ymd: str,
    period: str,
) -> None:
    row = by_date.setdefault(ymd, {"am": False, "pm": False})
    if period == "both":
        row["am"] = True
        row["pm"] = True
    elif period == "am":
        row["am"] = True
    elif period == "pm":
        row["pm"] = True


def merge_calendar_blockers_for_purpose(
    session: Session,
    *,
    purpose: str,
    from_date: date,
    to_date: date,
) -> list[dict[str, str]]:
    """Return sorted ``{date, period}`` blockers for API consumers."""
    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    by_date: dict[str, dict[str, bool]] = {}

    repo_rows = (
        session.execute(
            select(CalendarManualBlock)
            .where(CalendarManualBlock.purpose == purpose)
            .where(CalendarManualBlock.block_date >= from_date)
            .where(CalendarManualBlock.block_date <= to_date)
        )
        .scalars()
        .all()
    )
    for row in repo_rows:
        ymd = row.block_date.isoformat()
        _apply_period(by_date, ymd, row.period)

    range_start_local = datetime.combine(from_date, time.min, tzinfo=zone)
    range_end_local = datetime.combine(to_date, time.max, tzinfo=zone)
    range_start_utc = range_start_local.astimezone(UTC)
    range_end_utc = range_end_local.astimezone(UTC)

    slot_stmt = select_public_calendar_blocker_session_slots(
        range_start_utc=range_start_utc,
        range_end_utc=range_end_utc,
    )
    for starts_at, ends_at in session.execute(slot_stmt).all():
        if starts_at is None or ends_at is None:
            continue
        start_u = starts_at if starts_at.tzinfo else starts_at.replace(tzinfo=UTC)
        end_u = ends_at if ends_at.tzinfo else ends_at.replace(tzinfo=UTC)
        d_start = start_u.astimezone(zone).date()
        d_end = end_u.astimezone(zone).date()
        cur = max(d_start, from_date)
        end_d = min(d_end, to_date)
        while cur <= end_d:
            ymd = cur.isoformat()
            am_win = _window_utc_for_local_hours(
                ymd,
                start_hour=_AM_START_HOUR,
                end_hour=_AM_END_HOUR,
                zone=zone,
            )
            pm_win = _window_utc_for_local_hours(
                ymd,
                start_hour=_PM_START_HOUR,
                end_hour=_PM_END_HOUR,
                zone=zone,
            )
            if am_win and _intervals_overlap(start_u, end_u, am_win[0], am_win[1]):
                _apply_period(by_date, ymd, "am")
            if pm_win and _intervals_overlap(start_u, end_u, pm_win[0], pm_win[1]):
                _apply_period(by_date, ymd, "pm")
            cur += timedelta(days=1)

    return _merge_period_map(by_date)


def half_day_period_for_consultation_iso(
    *,
    start_iso: str,
    wall_zone: str | None = None,
) -> tuple[date, CalendarBlockPeriod] | None:
    """Map an ISO instant to (local calendar date, am|pm) for consultation windows.

    AM = local hour in [09:00, 12:00); PM = [14:00, 18:00). The gap 12:00–14:00
    and outside 09–18 are invalid (returns None).
    """
    try:
        start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    except ValueError:
        logger.info(
            "consultation_slot_classification_failed",
            extra={"reason": "iso_parse_error"},
        )
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    else:
        start = start.astimezone(UTC)

    zone_name = (wall_zone or "").strip() or resolve_calendar_blockers_wall_timezone()
    try:
        zone = ZoneInfo(zone_name)
    except Exception:
        logger.warning(
            "consultation_slot_classification_failed",
            extra={"reason": "invalid_wall_zone", "wall_zone": zone_name},
        )
        return None

    local = start.astimezone(zone)
    ymd = local.strftime("%Y-%m-%d")
    try:
        y, m, d_part = (int(ymd[0:4]), int(ymd[5:7]), int(ymd[8:10]))
        day_local = date(y, m, d_part)
    except (ValueError, IndexError):
        return None

    hour = local.hour
    minute = local.minute
    second = local.second
    if second != 0 or minute != 0:
        logger.info(
            "consultation_slot_classification_failed",
            extra={"reason": "non_zero_subminute", "ymd": ymd},
        )
        return None

    if _AM_START_HOUR <= hour < _AM_END_HOUR:
        return day_local, "am"
    if _PM_START_HOUR <= hour < _PM_END_HOUR:
        return day_local, "pm"

    logger.info(
        "consultation_slot_classification_failed",
        extra={
            "reason": "outside_am_pm_windows",
            "ymd": ymd,
            "hour": hour,
        },
    )
    return None


def _blocked_ymd_period_set(
    session: Session,
    *,
    purpose: str,
    from_date: date,
    to_date: date,
) -> set[tuple[str, CalendarBlockPeriod]]:
    """Single merge for a date range; returns {(ymd, am|pm)} blocked half-days."""
    blockers = merge_calendar_blockers_for_purpose(
        session,
        purpose=purpose,
        from_date=from_date,
        to_date=to_date,
    )
    out: set[tuple[str, CalendarBlockPeriod]] = set()
    for b in blockers:
        d = str(b.get("date") or "")
        p = str(b.get("period") or "")
        if not d:
            continue
        if p == "both":
            out.add((d, "am"))
            out.add((d, "pm"))
        elif p == "am":
            out.add((d, "am"))
        elif p == "pm":
            out.add((d, "pm"))
    return out


def consultation_datetime_blocked(
    *,
    start_iso: str,
    purpose: str,
    session: Session,
) -> bool:
    """True when the instant maps to a blocked consultation half-day."""
    classified = half_day_period_for_consultation_iso(start_iso=start_iso)
    if classified is None:
        return True
    day_local, period = classified
    blocked = _blocked_ymd_period_set(
        session,
        purpose=purpose,
        from_date=day_local,
        to_date=day_local,
    )
    return (day_local.isoformat(), period) in blocked


def consultation_reservation_has_blocked_slot(
    *,
    session: Session,
    purpose: str,
    primary_start_iso: str | None,
    session_slots: list[dict[str, str]] | None,
) -> bool:
    """True if any primary or session slot start maps to a blocked half-day."""
    starts: list[str] = []
    if primary_start_iso and str(primary_start_iso).strip():
        starts.append(str(primary_start_iso).strip())
    for row in session_slots or []:
        s = row.get("start_iso")
        if isinstance(s, str) and s.strip():
            starts.append(s.strip())
    for iso in starts:
        if consultation_datetime_blocked(
            start_iso=iso, purpose=purpose, session=session
        ):
            logger.info(
                "consultation_reservation_blocked_slot",
                extra={"reason": "blocked_half_day"},
            )
            return True
    return False


def validate_session_slot_chronology(
    session_slots: list[dict[str, str]] | None,
) -> str | None:
    """Return error message key if any slot has end before or equal to start."""
    for row in session_slots or []:
        start_s = row.get("start_iso")
        end_s = row.get("end_iso")
        if not isinstance(start_s, str) or not start_s.strip():
            continue
        if not isinstance(end_s, str) or not end_s.strip():
            continue
        try:
            s0 = datetime.fromisoformat(start_s.strip().replace("Z", "+00:00"))
            s1 = datetime.fromisoformat(end_s.strip().replace("Z", "+00:00"))
        except ValueError:
            return "invalid_session_slot_iso"
        if s0.tzinfo is None:
            s0 = s0.replace(tzinfo=UTC)
        else:
            s0 = s0.astimezone(UTC)
        if s1.tzinfo is None:
            s1 = s1.replace(tzinfo=UTC)
        else:
            s1 = s1.astimezone(UTC)
        if s1 <= s0:
            return "session_slot_end_before_start"
    return None
