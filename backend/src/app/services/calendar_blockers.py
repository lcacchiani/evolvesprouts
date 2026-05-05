"""Merge manual calendar blocks with session-derived half-day blockers."""

from __future__ import annotations

import os
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from app.db.models.calendar_manual_block import CalendarManualBlock
from app.db.models import InstanceSessionSlot, Service, ServiceInstance
from app.db.repositories.service_instance import (
    public_calendar_blocker_instance_predicates,
    select_public_calendar_blocker_session_slots,
)
from app.exceptions import ValidationError
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
_PURPOSE_INTRO_CALL_BOOKING = "intro_call_booking"

_ALLOWED_PUBLIC_BLOCKER_PURPOSES: frozenset[str] = frozenset(
    {_PURPOSE_CONSULTATION_BOOKING, _PURPOSE_INTRO_CALL_BOOKING}
)


def allowed_manual_block_creation_purposes() -> frozenset[str]:
    """Purposes allowed for admin-created manual blocks (keep in sync with public read allowlist)."""
    return _ALLOWED_PUBLIC_BLOCKER_PURPOSES


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


def classify_consultation_start_local_half_day(
    *,
    start_iso: str,
    wall_zone: str | None = None,
    field: str = "primarySessionStartIso",
) -> tuple[date, CalendarBlockPeriod]:
    """Map an ISO instant to (local calendar date, am|pm) using wall-clock hour rules.

    Morning = local hour before 12; afternoon = local hour 14 or later.
    Local hours 12--13 (noon gap) and invalid timestamps raise ``ValidationError``.
    """
    try:
        start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    except ValueError:
        logger.info(
            "consultation_slot_classification_failed",
            extra={"reason": "iso_parse_error", "field": field},
        )
        raise ValidationError(
            "Invalid consultation session start time format.",
            field=field,
        ) from None

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
            extra={
                "reason": "invalid_wall_zone",
                "wall_zone": zone_name,
                "field": field,
            },
        )
        raise ValidationError(
            "Consultation booking time could not be interpreted (invalid timezone).",
            field=field,
        ) from None

    local = start.astimezone(zone)
    ymd = local.strftime("%Y-%m-%d")
    try:
        y, m, d_part = (int(ymd[0:4]), int(ymd[5:7]), int(ymd[8:10]))
        day_local = date(y, m, d_part)
    except (ValueError, IndexError):
        logger.info(
            "consultation_slot_classification_failed",
            extra={"reason": "invalid_local_date", "field": field},
        )
        raise ValidationError(
            "Invalid consultation session start time format.",
            field=field,
        ) from None

    hour = local.hour
    if hour < 12:
        period: CalendarBlockPeriod = "am"
    elif hour >= 14:
        period = "pm"
    else:
        logger.info(
            "consultation_slot_classification_failed",
            extra={
                "reason": "noon_gap_not_bookable",
                "field": field,
                "ymd": ymd,
                "hour": hour,
            },
        )
        raise ValidationError(
            "Consultation booking times must be in the morning (before noon) or "
            "afternoon (2pm or later) in the site calendar timezone.",
            field=field,
        )

    return day_local, period


def half_day_period_for_consultation_iso(
    *,
    start_iso: str,
    wall_zone: str | None = None,
) -> tuple[date, CalendarBlockPeriod] | None:
    """Best-effort map for read paths; returns ``None`` when classification fails."""
    try:
        return classify_consultation_start_local_half_day(
            start_iso=start_iso, wall_zone=wall_zone
        )
    except ValidationError:
        return None


def _manual_block_exists_for_half_day(
    session: Session,
    *,
    purpose: str,
    day_local: date,
    period: CalendarBlockPeriod,
) -> bool:
    """True when a manual row blocks this calendar half-day."""
    if period == "am":
        half_cond = or_(
            CalendarManualBlock.period == "am",
            CalendarManualBlock.period == "both",
        )
    else:
        half_cond = or_(
            CalendarManualBlock.period == "pm",
            CalendarManualBlock.period == "both",
        )
    stmt = select(
        exists().where(
            CalendarManualBlock.purpose == purpose,
            CalendarManualBlock.block_date == day_local,
            half_cond,
        )
    )
    return bool(session.execute(stmt).scalar())


def _session_blocks_half_day(
    session: Session,
    *,
    day_local: date,
    period: CalendarBlockPeriod,
) -> bool:
    """True when any eligible published session slot intersects the nominal AM/PM window."""
    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    ymd = day_local.isoformat()
    if period == "am":
        win = _window_utc_for_local_hours(
            ymd,
            start_hour=_AM_START_HOUR,
            end_hour=_AM_END_HOUR,
            zone=zone,
        )
    else:
        win = _window_utc_for_local_hours(
            ymd,
            start_hour=_PM_START_HOUR,
            end_hour=_PM_END_HOUR,
            zone=zone,
        )
    if win is None:
        return False
    w0, w1 = win
    overlap = and_(
        InstanceSessionSlot.starts_at < w1,
        InstanceSessionSlot.ends_at > w0,
    )
    stmt = (
        select(InstanceSessionSlot.id)
        .join(ServiceInstance, InstanceSessionSlot.instance_id == ServiceInstance.id)
        .join(Service, ServiceInstance.service_id == Service.id)
        .where(and_(*public_calendar_blocker_instance_predicates()))
        .where(overlap)
        .limit(1)
    )
    return session.execute(stmt).first() is not None


def is_consultation_half_day_blocked(
    session: Session,
    *,
    purpose: str,
    day_local: date,
    period: CalendarBlockPeriod,
) -> bool:
    """Whether the given local calendar half-day is blocked (manual ∪ session-derived)."""
    if _manual_block_exists_for_half_day(
        session, purpose=purpose, day_local=day_local, period=period
    ):
        return True
    return _session_blocks_half_day(session, day_local=day_local, period=period)


def raise_if_consultation_reservation_blocked(
    *,
    session: Session,
    purpose: str,
    primary_start_iso: str | None,
    session_slots: list[dict[str, str]] | None,
) -> None:
    """Raise ``ValidationError`` if any slot maps to a blocked half-day or invalid time."""
    starts: list[tuple[str, str]] = []
    if primary_start_iso and str(primary_start_iso).strip():
        starts.append((str(primary_start_iso).strip(), "primarySessionStartIso"))
    for idx, row in enumerate(session_slots or []):
        s = row.get("start_iso")
        if isinstance(s, str) and s.strip():
            starts.append((s.strip(), f"sessionSlots[{idx}].startIso"))

    for iso, field in starts:
        day_local, period = classify_consultation_start_local_half_day(
            start_iso=iso, field=field
        )
        if is_consultation_half_day_blocked(
            session, purpose=purpose, day_local=day_local, period=period
        ):
            logger.info(
                "consultation_reservation_blocked_slot",
                extra={"reason": "blocked_half_day", "field": field},
            )
            raise ValidationError(
                "The selected consultation time is no longer available. "
                "Please pick another slot.",
                field=field,
            )


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
