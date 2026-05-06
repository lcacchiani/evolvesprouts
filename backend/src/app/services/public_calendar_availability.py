"""Unified public calendar availability: purposes, parsing, busy intervals, responses."""

from __future__ import annotations

import re
from bisect import bisect_left
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.db.models import InstanceSessionSlot, Service, ServiceInstance
from app.db.models.calendar_manual_block import CalendarManualBlock
from app.db.models.enums import ServiceType
from app.db.repositories.service_instance import (
    select_public_calendar_blocker_session_slots,
)
from app.exceptions import ValidationError
from app.services.calendar_blockers import (
    _window_utc_for_local_hours,
    consultation_booking_purpose,
    resolve_calendar_blockers_wall_timezone,
)

_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class AvailabilityPurpose(StrEnum):
    """Single source of truth for public calendar availability purposes."""

    CONSULTATION_BOOKING = "consultation_booking"
    INTRO_CALL_BOOKING = "intro_call_booking"


@dataclass(frozen=True)
class AvailabilityWindow:
    """Horizon and optional forward-cap for availability date-range validation."""

    default_horizon_days: int
    max_horizon_days: int
    max_forward_days: int | None


@dataclass(frozen=True)
class AvailabilityLead:
    """Lead-time rule; consultation uses calendar days, intro-call uses hours."""

    lead_hours: int | None
    lead_calendar_days: int | None


@dataclass(frozen=True)
class AvailabilitySpec:
    """Per-purpose availability configuration and compute hooks."""

    purpose: AvailabilityPurpose
    wall_timezone_resolver: Callable[[], str]
    cache_policy: Literal["no_store", "public_cacheable"]
    window: AvailabilityWindow
    lead: AvailabilityLead
    compute: Callable[[Session, date, date, datetime], list[tuple[datetime, datetime]]]
    is_grid_aligned_local: Callable[[datetime], bool]


def _is_consultation_grid_aligned_local(dt: datetime) -> bool:
    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    local = dt.astimezone(zone)
    if local.weekday() not in (0, 1, 2, 3, 4):
        return False
    return (
        local.hour in (9, 14)
        and local.minute == 0
        and local.second == 0
        and local.microsecond == 0
    )


def is_consultation_booking_start_grid_aligned(dt: datetime) -> bool:
    """True when ``dt`` is Mon–Fri at exactly 09:00 or 14:00 local wall time."""
    return _is_consultation_grid_aligned_local(dt)


def _intro_grid_placeholder(_dt: datetime) -> bool:
    return True


def _resolve_intro_wall_timezone() -> str:
    from app.services.intro_call_slots import resolve_intro_call_wall_timezone

    return resolve_intro_call_wall_timezone()


def _compute_consultation_slots(
    session: Session, from_date: date, to_date: date, now: datetime
) -> list[tuple[datetime, datetime]]:
    from app.services.calendar_blockers import compute_available_consultation_slots

    return compute_available_consultation_slots(
        session, from_date=from_date, to_date=to_date, now=now
    )


def _compute_intro_slots(
    session: Session, from_date: date, to_date: date, now: datetime
) -> list[tuple[datetime, datetime]]:
    from app.services.intro_call_slots import compute_available_intro_call_slots

    return compute_available_intro_call_slots(
        session, from_date=from_date, to_date=to_date, now=now
    )


_PUBLIC_AVAILABILITY_SPECS: dict[AvailabilityPurpose, AvailabilitySpec] = {
    AvailabilityPurpose.CONSULTATION_BOOKING: AvailabilitySpec(
        purpose=AvailabilityPurpose.CONSULTATION_BOOKING,
        wall_timezone_resolver=resolve_calendar_blockers_wall_timezone,
        cache_policy="no_store",
        window=AvailabilityWindow(
            default_horizon_days=120,
            max_horizon_days=120,
            max_forward_days=None,
        ),
        lead=AvailabilityLead(lead_hours=None, lead_calendar_days=2),
        compute=_compute_consultation_slots,
        is_grid_aligned_local=_is_consultation_grid_aligned_local,
    ),
    AvailabilityPurpose.INTRO_CALL_BOOKING: AvailabilitySpec(
        purpose=AvailabilityPurpose.INTRO_CALL_BOOKING,
        wall_timezone_resolver=_resolve_intro_wall_timezone,
        cache_policy="public_cacheable",
        window=AvailabilityWindow(
            default_horizon_days=21,
            max_horizon_days=28,
            max_forward_days=35,
        ),
        lead=AvailabilityLead(lead_hours=2, lead_calendar_days=None),
        compute=_compute_intro_slots,
        is_grid_aligned_local=_intro_grid_placeholder,
    ),
}


def purpose_enum_from_query(raw: str | None) -> AvailabilityPurpose:
    """Resolve strict purpose enum from query text."""
    s = str(raw or "").strip().lower()
    if not s:
        raise ValidationError("purpose query parameter is required", field="purpose")
    try:
        return AvailabilityPurpose(s)
    except ValueError as exc:
        raise ValidationError("Unsupported purpose", field="purpose") from exc


def parse_iso_date_strict(raw: Any) -> date | None:
    """Parse YYYY-MM-DD or return ``None`` when invalid."""
    if raw is None or str(raw).strip() == "":
        return None
    s = str(raw).strip()
    if not _DATE_PATTERN.fullmatch(s):
        return None
    try:
        y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
        return date(y, m, d)
    except ValueError:
        return None


def parse_availability_request(
    event: Mapping[str, Any],
) -> tuple[AvailabilitySpec, date, date]:
    """Validate query params and return spec plus inclusive ``(from_date, to_date)``."""
    query = event.get("queryStringParameters") or {}
    if not isinstance(query, Mapping):
        query = {}

    purpose = purpose_enum_from_query(
        query.get("purpose") if isinstance(query, Mapping) else None
    )
    spec = _PUBLIC_AVAILABILITY_SPECS[purpose]

    zone = ZoneInfo(spec.wall_timezone_resolver())
    today = datetime.now(tz=zone).date()

    from_raw = query.get("from")
    to_raw = query.get("to")

    if from_raw in (None, "") or (isinstance(from_raw, str) and not from_raw.strip()):
        from_date = today
    else:
        parsed_from = parse_iso_date_strict(from_raw)
        if parsed_from is None:
            raise ValidationError("Invalid from date", field="from")
        from_date = parsed_from

    default_to = from_date + timedelta(days=spec.window.default_horizon_days)
    if to_raw not in (None, "") and str(to_raw).strip() != "":
        parsed_to = parse_iso_date_strict(to_raw)
        if parsed_to is None:
            raise ValidationError("Invalid to date", field="to")
        to_date = parsed_to
    else:
        to_date = default_to

    if to_date < from_date:
        raise ValidationError("to must be on or after from", field="to")

    span_days = (to_date - from_date).days
    if span_days > spec.window.max_horizon_days:
        raise ValidationError(
            f"Date range exceeds maximum of {spec.window.max_horizon_days} days",
            field="to",
        )

    max_forward = spec.window.max_forward_days
    if max_forward is not None and (from_date - today).days > max_forward:
        raise ValidationError("from is too far in the future", field="from")

    return spec, from_date, to_date


def serialize_availability_response(
    *,
    spec: AvailabilitySpec,
    from_date: date,
    to_date: date,
    slots: list[tuple[datetime, datetime]],
) -> dict[str, Any]:
    """Canonical JSON envelope for calendar availability responses."""
    meta: dict[str, Any] = {
        "purpose": spec.purpose.value,
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "wall_time_zone": spec.wall_timezone_resolver(),
        "default_horizon_days": spec.window.default_horizon_days,
        "max_horizon_days": spec.window.max_horizon_days,
    }
    mfd = spec.window.max_forward_days
    if mfd is not None:
        meta["max_forward_days"] = mfd
    if spec.lead.lead_hours is not None:
        meta["lead_hours"] = spec.lead.lead_hours
    if spec.lead.lead_calendar_days is not None:
        meta["lead_calendar_days"] = spec.lead.lead_calendar_days

    return {
        "slots": [
            {
                "start_iso": s0.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end_iso": s1.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            for s0, s1 in slots
        ],
        "meta": meta,
    }


def _norm_utc(dt: datetime) -> datetime:
    u = dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    return u.astimezone(UTC)


def _intervals_overlap(a0: datetime, a1: datetime, b0: datetime, b1: datetime) -> bool:
    return a0 < b1 and b0 < a1


def merge_intervals_union(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    """Merge sorted overlapping UTC intervals."""
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


def _manual_calendar_busy_intervals_utc(
    session: Session,
    *,
    from_date: date,
    to_date: date,
) -> list[tuple[datetime, datetime]]:
    """Manual AM/PM blocks for consultation + intro-call booking purposes."""
    from app.services.intro_call_slots import intro_call_purpose

    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    rows = session.execute(
        select(CalendarManualBlock.block_date, CalendarManualBlock.period).where(
            CalendarManualBlock.purpose.in_(
                (consultation_booking_purpose(), intro_call_purpose())
            ),
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
                start_hour=9,
                end_hour=12,
                zone=zone,
            )
            if win:
                intervals.append(win)
        if period in ("pm", "both"):
            win = _window_utc_for_local_hours(
                ymd,
                start_hour=14,
                end_hour=18,
                zone=zone,
            )
            if win:
                intervals.append(win)
    return intervals


def _consultation_instance_busy_intervals_utc(
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
            Service.service_type == ServiceType.CONSULTATION,
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


def intro_call_instance_busy_intervals_utc(
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
            Service.service_type == ServiceType.INTRO_CALL,
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


def busy_intervals_utc(
    session: Session,
    *,
    range_start_utc: datetime,
    range_end_utc: datetime,
    exclude_purposes: frozenset[AvailabilityPurpose] = frozenset(),
) -> list[tuple[datetime, datetime]]:
    """Union of busy intervals (manual, events/training, consultation, intro-call)."""
    zone = ZoneInfo(resolve_calendar_blockers_wall_timezone())
    local_start = range_start_utc.astimezone(zone).date()
    local_end = range_end_utc.astimezone(zone).date()

    busy: list[tuple[datetime, datetime]] = []
    busy.extend(
        _manual_calendar_busy_intervals_utc(
            session, from_date=local_start, to_date=local_end
        )
    )

    slot_stmt = select_public_calendar_blocker_session_slots(
        range_start_utc=range_start_utc,
        range_end_utc=range_end_utc,
    )
    for starts_at, ends_at in session.execute(slot_stmt).all():
        if starts_at is None or ends_at is None:
            continue
        s0 = starts_at if starts_at.tzinfo else starts_at.replace(tzinfo=UTC)
        s1 = ends_at if ends_at.tzinfo else ends_at.replace(tzinfo=UTC)
        busy.append((s0, s1))

    busy.extend(
        _consultation_instance_busy_intervals_utc(
            session,
            range_start_utc=range_start_utc,
            range_end_utc=range_end_utc,
        )
    )

    if AvailabilityPurpose.INTRO_CALL_BOOKING not in exclude_purposes:
        busy.extend(
            intro_call_instance_busy_intervals_utc(
                session,
                range_start_utc=range_start_utc,
                range_end_utc=range_end_utc,
            )
        )

    return merge_intervals_union(busy)


def candidate_overlaps_merged_busy(
    start_utc: datetime,
    end_utc: datetime,
    busy_merged: list[tuple[datetime, datetime]],
) -> bool:
    """Whether ``[start_utc, end_utc)`` overlaps any merged busy interval."""
    if not busy_merged:
        return False
    s0 = _norm_utc(start_utc)
    s1 = _norm_utc(end_utc)
    starts = [b[0] for b in busy_merged]
    i = bisect_left(starts, s1)
    for j in (i - 1, i):
        if 0 <= j < len(busy_merged):
            b0, b1 = busy_merged[j]
            if _intervals_overlap(s0, s1, b0, b1):
                return True
    return False
