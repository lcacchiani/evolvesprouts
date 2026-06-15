"""Intro-call and consultation grid alignment invariants for public reservations."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.public_reservations_persistence import _parse_iso_datetime_utc
from app.api.public_reservations_validation import (
    _ALLOWED_CONSULTATION_SERVICE_KEYS,
    _INTRO_CALL_SERVICE_KEY,
    _MAX_INSTANCE_SLUG_LENGTH,
    _MAX_SERVICE_KEY_LENGTH,
    _SERVICE_KEY_PATTERN,
)
from app.db.models import Service, ServiceInstance
from app.db.models.enums import ServiceType
from app.exceptions import ConflictError, ValidationError
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN
from app.services.intro_call_slots import (
    enumerate_intro_call_candidate_slots,
    intro_call_cooldown_blocks_from_last_booked_at,
    intro_call_window,
    recent_intro_call_enrollment_last_booked_at,
    resolve_intro_call_wall_timezone,
)
from app.services.public_calendar_availability import (
    is_consultation_booking_start_grid_aligned,
)


def _assert_consultation_start_grid_aligned(
    reservation_payload: Mapping[str, Any],
) -> None:
    starts: list[tuple[str, str]] = []
    primary = reservation_payload.get("primary_session_start_iso")
    if primary and str(primary).strip():
        starts.append((str(primary).strip(), "primarySessionStartIso"))
    for idx, row in enumerate(reservation_payload.get("session_slots") or []):
        if not isinstance(row, dict):
            continue
        s = row.get("start_iso")
        if isinstance(s, str) and s.strip():
            starts.append((s.strip(), f"sessionSlots[{idx}].startIso"))

    for iso, field in starts:
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        except ValueError:
            raise ValidationError("Invalid timestamp", field=field) from None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        else:
            dt = dt.astimezone(UTC)
        if not is_consultation_booking_start_grid_aligned(dt):
            raise ValidationError(
                "The selected consultation time is not on the bookable schedule. "
                "Please pick another slot.",
                field=field,
            )


def _enforce_intro_call_invariants(
    session: Session,
    payload: Mapping[str, Any],
    catalog_service: Service,
    *,
    now: datetime,
) -> tuple[datetime, datetime]:
    if (payload.get("service_key") or "").strip().lower() != _INTRO_CALL_SERVICE_KEY:
        raise ValidationError(
            "serviceKey mismatch for intro-call booking", field="serviceKey"
        )
    if payload.get("total_amount") != Decimal("0"):
        raise ValidationError(
            "totalAmount must be 0 for intro-call booking", field="totalAmount"
        )
    pm = str(payload.get("payment_method") or "").strip().lower()
    if pm not in ("free", ""):
        raise ValidationError(
            "paymentMethod must be free for intro-call booking",
            field="paymentMethod",
        )
    start_s = payload.get("primary_session_start_iso")
    end_s = payload.get("primary_session_end_iso")
    if not start_s or not end_s:
        raise ValidationError(
            "primarySessionStartIso and primarySessionEndIso are required",
            field="primarySessionStartIso",
        )
    start_u = _parse_iso_datetime_utc(str(start_s))
    end_u = _parse_iso_datetime_utc(str(end_s))
    if start_u is None or end_u is None:
        raise ValidationError(
            "Invalid session ISO timestamps", field="primarySessionStartIso"
        )
    if end_u - start_u != timedelta(minutes=15):
        raise ValidationError(
            "Intro call must be exactly 15 minutes",
            field="primarySessionEndIso",
        )
    now_u = now if now.tzinfo else now.replace(tzinfo=UTC)
    if start_u < now_u + timedelta(hours=2):
        raise ValidationError(
            "Selected time is inside the minimum lead-time window",
            field="primarySessionStartIso",
        )
    wall = ZoneInfo(resolve_intro_call_wall_timezone())
    win_from, win_to = intro_call_window(now=now_u)
    start_local_date = start_u.astimezone(wall).date()
    if start_local_date < win_from or start_local_date > win_to:
        raise ValidationError(
            "Selected time is outside the booking horizon",
            field="primarySessionStartIso",
        )
    cand_from = win_from - timedelta(days=1)
    cand_to = win_to + timedelta(days=1)
    cand_set = {
        (a.astimezone(UTC), b.astimezone(UTC))
        for a, b in enumerate_intro_call_candidate_slots(cand_from, cand_to, now=now_u)
    }
    if (start_u, end_u) not in cand_set:
        raise ValidationError(
            "Selected time is outside office hours",
            field="primarySessionStartIso",
        )
    from app.api import public_reservations as pr

    if not pr.is_intro_call_slot_available(
        session, start_utc=start_u, end_utc=end_u, now=now_u
    ):
        raise ConflictError("slot_unavailable")
    prior_last_booked = recent_intro_call_enrollment_last_booked_at(
        session,
        email_lower=str(payload["attendee_email"]),
        within_days=30,
        now=now_u,
    )
    if prior_last_booked is not None and intro_call_cooldown_blocks_from_last_booked_at(
        prior_last_booked_at=prior_last_booked,
        now=now_u,
        cooldown_days=30,
    ):
        raise ConflictError("recent_intro_call_exists")
    if catalog_service.service_type != ServiceType.INTRO_CALL:
        raise ValidationError(
            "serviceType mismatch for intro-call booking", field="serviceKey"
        )
    return start_u, end_u


def _resolve_consultation_or_intro_service(
    session: Session, payload: Mapping[str, Any]
) -> Service:
    """Load the catalog ``services`` row for consultation or intro-call bookings.

    Does not row-lock the service; callers that mutate booking instances must lock
    the catalog row separately (see ``_create_booking_instance_for_service``).
    """
    raw_key = payload.get("service_key")
    service_key_str = str(raw_key).strip().lower() if raw_key not in (None, "") else ""
    if not service_key_str:
        raise ValidationError("serviceKey is required", field="serviceKey")
    if len(service_key_str) > _MAX_SERVICE_KEY_LENGTH:
        raise ValidationError("serviceKey is too long", field="serviceKey")
    if not _SERVICE_KEY_PATTERN.fullmatch(service_key_str):
        raise ValidationError(
            "serviceKey must match the public service key pattern",
            field="serviceKey",
        )
    booking_system = str(payload.get("booking_system") or "").strip().lower()
    statement = select(Service).where(
        func.lower(Service.service_key) == service_key_str
    )
    row = session.execute(statement).scalar_one_or_none()
    if row is None:
        raise ValidationError(
            "serviceKey does not match a published service",
            field="serviceKey",
            status_code=400,
        )
    if booking_system == "consultation-booking":
        if service_key_str not in _ALLOWED_CONSULTATION_SERVICE_KEYS:
            raise ValidationError(
                "serviceKey must be a consultation tier service key",
                field="serviceKey",
                status_code=400,
            )
        if row.service_type != ServiceType.CONSULTATION:
            raise ValidationError(
                "serviceKey must reference a consultation service",
                field="serviceKey",
                status_code=400,
            )
    elif booking_system == "intro-call-booking":
        if service_key_str != _INTRO_CALL_SERVICE_KEY:
            raise ValidationError(
                "serviceKey mismatch for intro-call booking",
                field="serviceKey",
            )
        if row.service_type != ServiceType.INTRO_CALL:
            raise ValidationError(
                "serviceKey must reference an intro-call service",
                field="serviceKey",
                status_code=400,
            )
    else:
        raise ValidationError(
            "bookingSystem must be consultation-booking or intro-call-booking",
            field="bookingSystem",
        )
    return row


def _resolve_booking_identity(
    session: Session, payload: Mapping[str, Any]
) -> ServiceInstance:
    """Resolve ``service_key`` + ``service_instance_slug`` to a loaded instance + parent service."""
    raw_key = payload.get("service_key")
    service_key_str = str(raw_key).strip().lower() if raw_key not in (None, "") else ""
    if not service_key_str:
        raise ValidationError("serviceKey is required", field="serviceKey")
    if len(service_key_str) > _MAX_SERVICE_KEY_LENGTH:
        raise ValidationError("serviceKey is too long", field="serviceKey")
    if not _SERVICE_KEY_PATTERN.fullmatch(service_key_str):
        raise ValidationError(
            "serviceKey must match the public service key pattern",
            field="serviceKey",
        )

    raw_slug = payload.get("service_instance_slug")
    slug_str = str(raw_slug).strip().lower() if raw_slug not in (None, "") else ""
    if not slug_str:
        raise ValidationError(
            "serviceInstanceSlug is required", field="serviceInstanceSlug"
        )
    if len(slug_str) > _MAX_INSTANCE_SLUG_LENGTH:
        raise ValidationError(
            "serviceInstanceSlug is too long", field="serviceInstanceSlug"
        )
    if not PUBLIC_INSTANCE_SLUG_PATTERN.fullmatch(slug_str):
        raise ValidationError(
            "serviceInstanceSlug must match the public slug pattern",
            field="serviceInstanceSlug",
        )

    from app.api import public_reservations as pr

    instance_repo = pr.ServiceInstanceRepository(session)
    resolved = instance_repo.get_with_service_by_slug(slug_str)
    if resolved is None:
        raise ValidationError(
            "service_instance_slug_mismatch",
            field="serviceInstanceSlug",
            status_code=400,
        )
    parent_key = (resolved.service.service_key or "").strip().lower()
    if parent_key != service_key_str:
        raise ValidationError(
            "service_instance_slug_mismatch",
            field="serviceInstanceSlug",
            status_code=400,
        )
    return resolved
