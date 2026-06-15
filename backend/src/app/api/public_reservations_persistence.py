"""Database persistence helpers for public reservation submissions."""

from __future__ import annotations

import secrets
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.public_discount_validate import (
    _is_usable_now as discount_code_is_usable_now,
)
from app.api.public_reservations_validation import (
    _ALLOWED_LOCALES,
    _MAX_FPS_DATA_URL_BYTES,
    _MAX_INSTANCE_SLUG_LENGTH,
    _MAX_ISO_FIELD,
)
from app.services.intro_call_slots import is_intro_call_slot_available
from app.db.models import Enrollment, InstanceSessionSlot, Service, ServiceInstance
from app.db.models.enums import (
    BillingBillToKind,
    DiscountType,
    EventbriteSyncStatus,
    InstanceStatus,
)
from app.db.models.family import FamilyMember
from app.db.models.organization import OrganizationMember
from app.db.repositories.service_instance import ServiceInstanceRepository
from app.exceptions import ConflictError, ValidationError
from app.utils.logging import get_logger, mask_email
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN

logger = get_logger(__name__)

_PUBLIC_RESERVATION_ENROLLMENT_ACTOR = "public-reservation"


def _parse_iso_datetime_utc(value: str | None) -> datetime | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _normalize_locale_field(value: Any) -> str:
    if not isinstance(value, str):
        return "en"
    s = value.strip()
    return s if s in _ALLOWED_LOCALES else "en"


def _parse_bool_opt(value: Any, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _parse_session_slots(raw: Any) -> list[dict[str, str]] | None:
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise ValidationError("sessionSlots must be an array", field="sessionSlots")
    out: list[dict[str, str]] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, Mapping):
            raise ValidationError(
                "sessionSlots items must be objects",
                field="sessionSlots",
            )
        start = item.get("startIso")
        if not isinstance(start, str) or not start.strip():
            raise ValidationError(
                f"sessionSlots[{idx}].startIso is required",
                field="sessionSlots",
            )
        start_norm = start.strip()
        if len(start_norm) > _MAX_ISO_FIELD:
            raise ValidationError(
                f"sessionSlots[{idx}].startIso is too long",
                field="sessionSlots",
            )
        row: dict[str, str] = {"start_iso": start_norm}
        end_raw = item.get("endIso")
        if end_raw is not None:
            if not isinstance(end_raw, str):
                raise ValidationError(
                    f"sessionSlots[{idx}].endIso must be a string",
                    field="sessionSlots",
                )
            end_norm = end_raw.strip()
            if len(end_norm) > _MAX_ISO_FIELD:
                raise ValidationError(
                    f"sessionSlots[{idx}].endIso is too long",
                    field="sessionSlots",
                )
            if end_norm:
                row["end_iso"] = end_norm
        out.append(row)
    return out or None


def _optional_fps_qr_data_url(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(
            "fpsQrImageDataUrl must be a string", field="fpsQrImageDataUrl"
        )
    s = value.strip()
    if not s:
        return None
    if len(s.encode("utf-8")) > _MAX_FPS_DATA_URL_BYTES:
        raise ValidationError(
            "fpsQrImageDataUrl exceeds maximum size",
            field="fpsQrImageDataUrl",
        )
    return s


def _generate_booking_instance_slug(*, service_key: str, now_utc: datetime) -> str:
    slug_part = service_key.strip().lower()
    suffix = secrets.token_hex(4)
    raw = f"{slug_part}-{now_utc:%Y%m%d%H%M%S}-{suffix}"
    if len(raw) > _MAX_INSTANCE_SLUG_LENGTH:
        raw = raw[:_MAX_INSTANCE_SLUG_LENGTH]
    if not PUBLIC_INSTANCE_SLUG_PATTERN.fullmatch(raw):
        raise ValidationError(
            "Unable to allocate a valid booking instance slug",
            field="serviceInstanceSlug",
            status_code=500,
        )
    return raw


def _create_booking_instance_for_service(
    session: Session,
    instance_repo: ServiceInstanceRepository,
    service: Service,
    payload: Mapping[str, Any],
    *,
    now_utc: datetime,
) -> ServiceInstance:
    locked = session.execute(
        select(Service).where(Service.id == service.id).with_for_update()
    ).scalar_one_or_none()
    if locked is None:
        raise ValidationError(
            "serviceKey does not match a published service",
            field="serviceKey",
            status_code=400,
        )
    service_key_str = (locked.service_key or "").strip().lower()
    if not service_key_str:
        raise ValidationError(
            "serviceKey does not match a published service",
            field="serviceKey",
            status_code=400,
        )
    attendee = str(payload.get("attendee_name") or "").strip()
    title_base = f"{locked.title} – {attendee}" if attendee else locked.title
    last_exc: IntegrityError | None = None
    for _attempt in range(3):
        slug = _generate_booking_instance_slug(
            service_key=service_key_str,
            now_utc=now_utc,
        )
        booking = ServiceInstance(
            service_id=locked.id,
            title=title_base,
            slug=slug,
            description=None,
            cover_image_s3_key=None,
            status=InstanceStatus.OPEN,
            delivery_mode=locked.delivery_mode,
            location_id=locked.location_id,
            max_capacity=1,
            waitlist_enabled=False,
            instructor_id=None,
            cohort=None,
            notes=None,
            created_by=_PUBLIC_RESERVATION_ENROLLMENT_ACTOR,
            external_url=None,
            eventbrite_sync_status=EventbriteSyncStatus.SKIPPED,
        )
        try:
            with session.begin_nested():
                return instance_repo.create_instance(
                    booking, type_details=None, session_slots=None
                )
        except IntegrityError as exc:
            last_exc = exc
            continue
    raise ValidationError(
        "Unable to allocate booking instance",
        field="serviceInstanceSlug",
        status_code=500,
    ) from last_exc


def _consultation_booking_slot_rows(
    payload: Mapping[str, Any],
) -> list[tuple[datetime, datetime, int]]:
    raw_start = payload.get("primary_session_start_iso")
    raw_end = payload.get("primary_session_end_iso")
    if not raw_start or not raw_end:
        raise ValidationError(
            "primarySessionStartIso and primarySessionEndIso are required for "
            "consultation bookings",
            field="primarySessionStartIso",
        )
    ps = _parse_iso_datetime_utc(str(raw_start))
    pe = _parse_iso_datetime_utc(str(raw_end))
    if ps is None or pe is None:
        raise ValidationError(
            "Invalid consultation session ISO timestamps",
            field="primarySessionStartIso",
        )
    if pe <= ps:
        raise ValidationError(
            "Consultation primary session must end after it starts",
            field="primarySessionEndIso",
        )
    primary_duration = pe - ps
    rows: list[tuple[datetime, datetime, int]] = [(ps, pe, 0)]
    seen: set[datetime] = {ps}
    extras = payload.get("session_slots") or []
    for idx, row in enumerate(extras):
        start_s = row.get("start_iso")
        end_s = row.get("end_iso")
        if not isinstance(start_s, str) or not start_s.strip():
            continue
        ss = _parse_iso_datetime_utc(start_s.strip())
        if ss is None:
            raise ValidationError(
                "Invalid consultation session slot timestamps",
                field="sessionSlots",
            )
        if isinstance(end_s, str) and end_s.strip():
            es = _parse_iso_datetime_utc(end_s.strip())
            if es is None:
                raise ValidationError(
                    "Invalid consultation session slot timestamps",
                    field="sessionSlots",
                )
        else:
            es = ss + primary_duration
        if es <= ss:
            raise ValidationError(
                "Each session slot must end after its start time",
                field="sessionSlots",
            )
        if ss in seen:
            continue
        seen.add(ss)
        rows.append((ss, es, idx + 1))
    return rows


def _persist_session_slots_for_booking_instance(
    session: Session,
    *,
    booking_instance_id: UUID,
    purpose_service_id: UUID,
    slots: list[tuple[datetime, datetime, int]],
    reservation_payload: Mapping[str, Any],
    now_utc: datetime,
    is_intro_booking: bool,
) -> None:
    for start_u, end_u, sort_order in slots:
        session.add(
            InstanceSessionSlot(
                instance_id=booking_instance_id,
                purpose_service_id=purpose_service_id,
                location_id=None,
                starts_at=start_u,
                ends_at=end_u,
                sort_order=sort_order,
            )
        )
    try:
        session.flush()
    except IntegrityError as exc:
        logger.info(
            "booking_purpose_service_slot_unique_violation",
            extra={
                "attendee_email": mask_email(
                    str(reservation_payload.get("attendee_email"))
                ),
            },
        )
        raise ConflictError("slot_unavailable") from exc
    if is_intro_booking and slots:
        s0, s1 = slots[0][0], slots[0][1]
        if not is_intro_call_slot_available(
            session,
            start_utc=s0,
            end_utc=s1,
            now=now_utc,
            exclude_intro_booking_interval=(s0, s1),
        ):
            raise ConflictError("slot_unavailable")


def _apply_enrollment_bill_to(
    enrollment: Enrollment,
    *,
    contact_id: UUID,
    bill: Mapping[str, Any],
) -> None:
    kind: BillingBillToKind = bill["bill_to_kind"]
    enrollment.bill_to_kind = kind
    if kind == BillingBillToKind.CONTACT:
        enrollment.bill_to_contact_id = bill.get("bill_to_contact_id") or contact_id
        enrollment.bill_to_family_id = None
        enrollment.bill_to_organization_id = None
    elif kind == BillingBillToKind.FAMILY:
        fid = bill.get("bill_to_family_id")
        if fid is None:
            raise ValidationError(
                "billToFamilyId is required when billToKind is family",
                field="billToFamilyId",
            )
        enrollment.bill_to_family_id = fid
        enrollment.bill_to_contact_id = None
        enrollment.bill_to_organization_id = None
    else:
        oid = bill.get("bill_to_organization_id")
        if oid is None:
            raise ValidationError(
                "billToOrganizationId is required when billToKind is organization",
                field="billToOrganizationId",
            )
        enrollment.bill_to_organization_id = oid
        enrollment.bill_to_contact_id = None
        enrollment.bill_to_family_id = None


def _validate_public_bill_to_membership(
    session: Session, bill: Mapping[str, Any], *, contact_id: UUID
) -> None:
    """Ensure bill-to family/org exists and the contact is a member."""
    kind = bill["bill_to_kind"]
    if kind == BillingBillToKind.FAMILY:
        fid = bill.get("bill_to_family_id")
        if fid is None:
            return
        fam_row = session.execute(
            select(FamilyMember.id).where(
                FamilyMember.family_id == fid,
                FamilyMember.contact_id == contact_id,
            )
        ).first()
        if fam_row is None:
            raise ValidationError(
                "Contact is not a member of this family",
                field="billToFamilyId",
            )
    elif kind == BillingBillToKind.ORGANIZATION:
        oid = bill.get("bill_to_organization_id")
        if oid is None:
            return
        org_row = session.execute(
            select(OrganizationMember.id).where(
                OrganizationMember.organization_id == oid,
                OrganizationMember.contact_id == contact_id,
            )
        ).first()
        if org_row is None:
            raise ValidationError(
                "Contact is not a member of this organization",
                field="billToOrganizationId",
            )


def _validate_discount_code_redemption_scope(
    session: Session,
    payload: Mapping[str, Any],
    *,
    resolved_service: Service,
    resolved_instance: ServiceInstance | None,
) -> None:
    """Ensure discount code scope matches the reservation context."""
    from app.api import public_reservations as pr

    code = payload.get("discount_code")
    if not code:
        return

    repository = pr.DiscountCodeRepository(session)
    row = repository.get_by_code(str(code))
    if row is None or not discount_code_is_usable_now(row):
        raise ValidationError("Invalid discount code", field="discountCode")

    if row.discount_type == DiscountType.REFERRAL:
        raise ValidationError("Invalid discount code", field="discountCode")

    if row.instance_id is not None:
        if resolved_instance is None:
            raise ValidationError(
                "Discount code is not valid for this booking",
                field="discountCode",
            )
        if row.instance_id != resolved_instance.id:
            raise ValidationError(
                "Discount code is not valid for this booking",
                field="discountCode",
            )
        return

    if row.service_id is None:
        return

    if row.service_id != resolved_service.id:
        raise ValidationError(
            "Discount code is not valid for this booking",
            field="discountCode",
        )
