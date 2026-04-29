"""Merge manual calendar blocks with session-derived half-day blockers."""

from __future__ import annotations

import os
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import InstanceSessionSlot, Service, ServiceInstance
from app.db.models.calendar_manual_block import CalendarManualBlock
from app.db.models.enums import InstanceStatus, ServiceStatus, ServiceType

CalendarBlockPeriod = Literal["am", "pm", "both"]

_ENV_CALENDAR_BLOCKERS_WALL_TIMEZONE = "CALENDAR_BLOCKERS_WALL_TIMEZONE"
_DEFAULT_WALL_TIMEZONE = "Asia/Hong_Kong"

# Match public consultation picker nominal windows (local wall clock).
_AM_START_HOUR = 9
_AM_END_HOUR = 12
_PM_START_HOUR = 14
_PM_END_HOUR = 18

_PURPOSE_CONSULTATION_BOOKING = "consultation_booking"


def resolve_calendar_blockers_wall_timezone() -> str:
    raw = os.getenv(_ENV_CALENDAR_BLOCKERS_WALL_TIMEZONE, "").strip()
    return raw or _DEFAULT_WALL_TIMEZONE


def consultation_booking_purpose() -> str:
    return _PURPOSE_CONSULTATION_BOOKING


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
    start_local = datetime.combine(day_local, time(hour=start_hour, minute=0), tzinfo=zone)
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

    slot_stmt = (
        select(InstanceSessionSlot.starts_at, InstanceSessionSlot.ends_at)
        .join(ServiceInstance, InstanceSessionSlot.instance_id == ServiceInstance.id)
        .join(Service, ServiceInstance.service_id == Service.id)
        .where(Service.service_type.in_((ServiceType.EVENT, ServiceType.TRAINING_COURSE)))
        .where(Service.status == ServiceStatus.PUBLISHED)
        .where(ServiceInstance.status != InstanceStatus.CANCELLED)
        .where(
            ServiceInstance.status.in_(
                [
                    InstanceStatus.SCHEDULED,
                    InstanceStatus.OPEN,
                    InstanceStatus.FULL,
                    InstanceStatus.IN_PROGRESS,
                    InstanceStatus.COMPLETED,
                ]
            )
        )
        .where(InstanceSessionSlot.starts_at < range_end_utc)
        .where(InstanceSessionSlot.ends_at > range_start_utc)
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


def consultation_slot_blocked(
    *,
    primary_start_iso: str,
    purpose: str,
    session: Session,
) -> bool:
    """True when the consultation primary session instant falls on a blocked half-day."""
    try:
        start = datetime.fromisoformat(primary_start_iso.replace("Z", "+00:00"))
    except ValueError:
        return True
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    else:
        start = start.astimezone(UTC)

    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    ymd = _ymd_in_zone(start, zone)
    try:
        y, m, d_part = (int(ymd[0:4]), int(ymd[5:7]), int(ymd[8:10]))
        day_local = date(y, m, d_part)
    except (ValueError, IndexError):
        return True

    hour = start.astimezone(zone).hour
    minute = start.astimezone(zone).minute
    second = start.astimezone(zone).second
    if hour == _AM_START_HOUR and minute == 0 and second == 0:
        period: CalendarBlockPeriod = "am"
    elif hour == _PM_START_HOUR and minute == 0 and second == 0:
        period = "pm"
    else:
        return True

    blockers = merge_calendar_blockers_for_purpose(
        session,
        purpose=purpose,
        from_date=day_local,
        to_date=day_local,
    )
    for b in blockers:
        if b.get("date") != ymd:
            continue
        p = str(b.get("period") or "")
        if p == "both":
            return True
        if p == period:
            return True
    return False
