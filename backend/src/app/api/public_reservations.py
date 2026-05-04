"""Public reservation submission handlers."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from decimal import InvalidOperation
from typing import Any
from collections.abc import Mapping
from urllib.parse import quote
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_request import parse_body
from app.api.validators import (
    validate_email,
    validate_phone_fields,
    validate_phone_region,
    validate_string_length,
)
from app.utils.phone import default_phone_region
from app.api.public_discount_validate import (
    _is_usable_now as discount_code_is_usable_now,
)
from app.api.public_form_hooks import (
    first_name_from_full_name,
    mailchimp_booking_tag_from_payload,
    maybe_subscribe_booking_marketing,
    normalize_body_locale,
    send_booking_confirmation_email,
)
from app.db.audit import AuditService, set_audit_context
from app.db.engine import get_engine
from app.db.models import Enrollment, InstanceSessionSlot, ServiceInstance
from app.db.repositories import (
    DiscountCodeRepository,
    EnrollmentRepository,
)
from app.db.repositories.service_instance import ServiceInstanceRepository
from app.api.discount_enrollment_scope import (
    ensure_discount_code_eligible_for_instance,
)
from app.db.models.enums import (
    BillingBillToKind,
    ContactSource,
    ContactType,
    DiscountType,
    EnrollmentStatus,
    FunnelStage,
    LeadEventType,
    LeadType,
    ServiceType,
)
from app.db.models.family import FamilyMember
from app.db.models.organization import OrganizationMember
from app.db.models.sales_lead import SalesLead
from app.db.repositories.contact import ContactRepository
from app.db.repositories.sales_lead import SalesLeadRepository
from app.exceptions import ConflictError, ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.services.calendar_blockers import (
    consultation_booking_purpose,
    raise_if_consultation_reservation_blocked,
    validate_session_slot_chronology,
)
from app.services.intro_call_slots import (
    enumerate_intro_call_candidate_slots,
    intro_call_cooldown_blocks_from_created_at,
    intro_call_window,
    is_intro_call_slot_available,
    recent_intro_call_enrollment_created_at,
)
from app.services.customer_billing import record_reservation_customer_payment
from app.services.public_form_internal_notifications import (
    build_reservation_recap_lines,
    send_sales_form_recap_email,
)
from app.services.stripe_payment_context import resolve_public_www_stripe_secret_key
from app.services.turnstile import (
    extract_client_ip,
    extract_turnstile_token,
    verify_turnstile_token,
)
from app.utils import json_response
from app.utils.fps_qr_png import optional_fps_qr_data_url_from_payload
from app.utils.logging import get_logger, mask_email, mask_pii
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN

logger = get_logger(__name__)

_MAX_NAME_LENGTH = 200
_MAX_PHONE_LENGTH = 40
_MAX_LABEL_LENGTH = 200
_MAX_PAYMENT_METHOD_LENGTH = 100
_MAX_TOPICS_LENGTH = 1000
_MAX_SLUG_KEY_LENGTH = 100
_MAX_LOCATION_NAME = 200
_MAX_LOCATION_ADDRESS = 300
_MAX_LOCATION_URL = 500
_MAX_ISO_FIELD = 50
_MAX_COHORT_DATE = 100
_MAX_DISCOUNT_CODE = 100
_MAX_INSTANCE_SLUG_LENGTH = 128
_MAX_FPS_DATA_URL_BYTES = 120_000
_MAX_TOTAL_AMOUNT = Decimal("1000000")
_STRIPE_PAYMENT_INTENTS_URL_PREFIX = "https://api.stripe.com/v1/payment_intents/"
_STRIPE_PAYMENT_INTENT_ID_PATTERN = re.compile(r"^pi_[A-Za-z0-9]+$")
_ALLOWED_LOCALES = frozenset({"en", "zh-CN", "zh-HK"})
_PUBLIC_RESERVATION_ENROLLMENT_ACTOR = "public-reservation"
_MAX_SERVICE_KEY_LENGTH = 80
_SERVICE_KEY_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_MAX_MARKETING_ATTRIBUTION_UTM_SOURCE = 100
_MAX_MARKETING_ATTRIBUTION_UTM_MEDIUM = 100
_MAX_MARKETING_ATTRIBUTION_UTM_CAMPAIGN = 200
_MAX_MARKETING_ATTRIBUTION_UTM_CONTENT = 200
_MAX_MARKETING_ATTRIBUTION_REFERRER = 500
_INTRO_CALL_INSTANCE_SLUG = "intro-call-free-15min"
_INTRO_CALL_SERVICE_KEY = "intro-call"
_PUBLIC_RESERVATION_BOOKING_SYSTEM_CODES = frozenset(
    {
        "consultation-booking",
        "event-booking",
        "my-best-auntie-booking",
        "intro-call-booking",
    }
)


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

    instance_repo = ServiceInstanceRepository(session)
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


def _parse_marketing_attribution(body: Mapping[str, Any]) -> dict[str, str] | None:
    raw = body.get("marketingAttribution") or body.get("marketing_attribution")
    if raw is None:
        return None
    if not isinstance(raw, Mapping):
        raise ValidationError(
            "marketingAttribution must be an object",
            field="marketingAttribution",
        )
    out: dict[str, str] = {}
    for key, max_len in (
        ("utm_source", _MAX_MARKETING_ATTRIBUTION_UTM_SOURCE),
        ("utm_medium", _MAX_MARKETING_ATTRIBUTION_UTM_MEDIUM),
        ("utm_campaign", _MAX_MARKETING_ATTRIBUTION_UTM_CAMPAIGN),
        ("utm_content", _MAX_MARKETING_ATTRIBUTION_UTM_CONTENT),
        ("referrer", _MAX_MARKETING_ATTRIBUTION_REFERRER),
    ):
        v = raw.get(key)
        if v is None or str(v).strip() == "":
            continue
        if not isinstance(v, str):
            raise ValidationError(
                f"marketingAttribution.{key} must be a string",
                field="marketingAttribution",
            )
        s = v.strip()
        if len(s) > max_len:
            raise ValidationError(
                f"marketingAttribution.{key} is too long",
                field="marketingAttribution",
            )
        out[key] = s
    extra = set(raw.keys()) - {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "referrer",
    }
    if extra:
        raise ValidationError(
            "marketingAttribution has unsupported properties",
            field="marketingAttribution",
        )
    return out or None


def _enforce_intro_call_invariants(
    session: Session,
    payload: Mapping[str, Any],
    resolved_instance: ServiceInstance,
    *,
    now: datetime,
) -> tuple[datetime, datetime]:
    if (payload.get("service_key") or "").strip().lower() != _INTRO_CALL_SERVICE_KEY:
        raise ValidationError(
            "serviceKey mismatch for intro-call booking", field="serviceKey"
        )
    slug = (payload.get("service_instance_slug") or "").strip().lower()
    if slug != _INTRO_CALL_INSTANCE_SLUG:
        raise ValidationError(
            "serviceInstanceSlug mismatch for intro-call booking",
            field="serviceInstanceSlug",
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
    from app.services.intro_call_slots import resolve_intro_call_wall_timezone

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
    if not is_intro_call_slot_available(
        session, start_utc=start_u, end_utc=end_u, now=now_u
    ):
        raise ConflictError("slot_unavailable")
    try:
        prior_created = recent_intro_call_enrollment_created_at(
            session,
            email_lower=str(payload["attendee_email"]),
            within_days=30,
            now=now_u,
        )
    except Exception:
        logger.exception(
            "intro_call_cooldown_lookup_failed",
            extra={"attendee_email": mask_email(str(payload.get("attendee_email")))},
        )
        prior_created = None
    if prior_created is not None and intro_call_cooldown_blocks_from_created_at(
        prior_created_at=prior_created,
        now=now_u,
        cooldown_days=30,
    ):
        raise ConflictError("recent_intro_call_exists")
    if resolved_instance.service.service_type != ServiceType.INTRO_CALL:
        raise ValidationError(
            "serviceType mismatch for intro-call booking", field="serviceKey"
        )
    return start_u, end_u


def _parse_bill_to_fields(
    body: Mapping[str, Any],
) -> dict[str, Any]:
    """Optional bill-to for enrollment (family/organization). Defaults to contact at persist."""
    raw_kind = body.get("billToKind") or body.get("bill_to_kind")
    if raw_kind is None or str(raw_kind).strip() == "":
        return {
            "bill_to_kind": BillingBillToKind.CONTACT,
            "bill_to_contact_id": None,
            "bill_to_family_id": None,
            "bill_to_organization_id": None,
        }
    s = str(raw_kind).strip().lower()
    if s == "contact":
        k = BillingBillToKind.CONTACT
    elif s == "family":
        k = BillingBillToKind.FAMILY
    elif s == "organization":
        k = BillingBillToKind.ORGANIZATION
    else:
        raise ValidationError(
            "billToKind must be contact, family, or organization",
            field="billToKind",
        )

    def _opt_uuid(field_camel: str, field_snake: str) -> UUID | None:
        raw = body.get(field_camel) or body.get(field_snake)
        if raw is None or str(raw).strip() == "":
            return None
        try:
            return UUID(str(raw).strip())
        except ValueError as exc:
            raise ValidationError(
                f"{field_camel} must be a valid UUID", field=field_camel
            ) from exc

    return {
        "bill_to_kind": k,
        "bill_to_contact_id": _opt_uuid("billToContactId", "bill_to_contact_id"),
        "bill_to_family_id": _opt_uuid("billToFamilyId", "bill_to_family_id"),
        "bill_to_organization_id": _opt_uuid(
            "billToOrganizationId", "bill_to_organization_id"
        ),
    }


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


def _handle_public_reservation(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle public reservation submissions."""
    if method != "POST":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    turnstile_token = extract_turnstile_token(event)
    if not turnstile_token:
        return json_response(
            400,
            {"error": "Missing X-Turnstile-Token header"},
            event=event,
        )

    remote_ip = extract_client_ip(event)
    is_turnstile_valid = verify_turnstile_token(turnstile_token, remote_ip=remote_ip)
    if not is_turnstile_valid:
        return json_response(
            403,
            {"error": "Captcha verification failed"},
            event=event,
        )

    try:
        body = parse_body(event)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    try:
        reservation_payload = _validate_reservation_payload(body)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    try:
        _validate_payment_confirmation(event, reservation_payload)
    except ValidationError as exc:
        return json_response(
            exc.status_code,
            exc.to_dict(),
            event=event,
        )

    try:
        request_id_str = str(event.get("requestContext", {}).get("requestId") or "")
        created_enrollment_id: UUID | None = None
        stripe_pi_idempotent_hit: bool = False
        stripe_pi_existing_payment_id: UUID | None = None
        with Session(get_engine()) as session:
            with session.begin():
                set_audit_context(
                    session,
                    user_id=None,
                    request_id=request_id_str or None,
                )
                resolved_instance = _resolve_booking_identity(
                    session, reservation_payload
                )
                reservation_payload = {
                    **reservation_payload,
                    "service_type": resolved_instance.service.service_type.value,
                }
                now_utc = datetime.now(tz=UTC)
                intro_slot_bounds: tuple[datetime, datetime] | None = None
                if reservation_payload.get("booking_system") == "intro-call-booking":
                    intro_slot_bounds = _enforce_intro_call_invariants(
                        session,
                        reservation_payload,
                        resolved_instance,
                        now=now_utc,
                    )
                elif (
                    reservation_payload.get("booking_system") == "consultation-booking"
                ):
                    start_iso = reservation_payload.get("primary_session_start_iso")
                    if not start_iso:
                        raise ValidationError(
                            "primarySessionStartIso is required for consultation bookings",
                            field="primarySessionStartIso",
                        )
                    slot_err = validate_session_slot_chronology(
                        reservation_payload.get("session_slots")
                    )
                    if slot_err == "session_slot_end_before_start":
                        raise ValidationError(
                            "Each session slot must end after its start time",
                            field="sessionSlots",
                        )
                    if slot_err == "invalid_session_slot_iso":
                        raise ValidationError(
                            "Invalid session slot date format",
                            field="sessionSlots",
                        )
                    raise_if_consultation_reservation_blocked(
                        session=session,
                        purpose=consultation_booking_purpose(),
                        primary_start_iso=str(start_iso),
                        session_slots=reservation_payload.get("session_slots"),
                    )
                _validate_discount_code_redemption_scope(
                    session, reservation_payload, resolved_instance=resolved_instance
                )
                contact_repo = ContactRepository(session)
                lead_repo = SalesLeadRepository(session)
                src_detail: str = "public-www-booking"
                ma_obj = reservation_payload.get("marketing_attribution")
                if reservation_payload.get("booking_system") == "intro-call-booking":
                    if isinstance(ma_obj, dict) and ma_obj:
                        src_detail = json.dumps(
                            {"source": "public-www-booking", **ma_obj},
                            separators=(",", ":"),
                        )
                    else:
                        src_detail = json.dumps(
                            {"source": "public-www-booking"}, separators=(",", ":")
                        )
                contact, _created = contact_repo.upsert_by_email(
                    reservation_payload["attendee_email"],
                    first_name=first_name_from_full_name(
                        reservation_payload["attendee_name"]
                    ),
                    source=ContactSource.RESERVATION,
                    source_detail=src_detail,
                    contact_type=ContactType.PARENT,
                )
                new_region = reservation_payload["phone_region"]
                new_national = reservation_payload["phone_national_number"]
                if (
                    new_region is not None
                    and new_national is not None
                    and (
                        contact.phone_region is None
                        or contact.phone_national_number is None
                    )
                ):
                    contact.phone_region = new_region
                    contact.phone_national_number = new_national
                contact_repo.update(contact)

                _validate_public_bill_to_membership(
                    session,
                    {
                        "bill_to_kind": reservation_payload["bill_to_kind"],
                        "bill_to_family_id": reservation_payload["bill_to_family_id"],
                        "bill_to_organization_id": reservation_payload[
                            "bill_to_organization_id"
                        ],
                    },
                    contact_id=contact.id,
                )

                dc_text = reservation_payload.get("discount_code")
                dc_row = None
                if dc_text:
                    dc_lookup = DiscountCodeRepository(session)
                    dc_row = dc_lookup.get_by_code(str(dc_text))

                instance_id_resolved = resolved_instance.id

                enrollment_repo = EnrollmentRepository(session)
                discount_repo = DiscountCodeRepository(session)
                has_enrollment = enrollment_repo.contact_has_enrollment_for_instance(
                    instance_id=instance_id_resolved,
                    contact_id=contact.id,
                )
                is_intro_booking = (
                    reservation_payload.get("booking_system") == "intro-call-booking"
                )

                def _persist_intro_call_slot_for_enrollment() -> None:
                    assert intro_slot_bounds is not None
                    s0, s1 = intro_slot_bounds
                    session.add(
                        InstanceSessionSlot(
                            instance_id=instance_id_resolved,
                            location_id=None,
                            starts_at=s0,
                            ends_at=s1,
                        )
                    )
                    try:
                        session.flush()
                    except IntegrityError as exc:
                        logger.info(
                            "intro_call_slot_unique_violation",
                            extra={
                                "attendee_email": mask_email(
                                    str(reservation_payload.get("attendee_email"))
                                ),
                            },
                        )
                        raise ConflictError("slot_unavailable") from exc
                    if not is_intro_call_slot_available(
                        session,
                        start_utc=s0,
                        end_utc=s1,
                        now=now_utc,
                        ignore_intro_slot=(s0, s1),
                    ):
                        raise ConflictError("slot_unavailable")

                if (
                    is_intro_booking
                    and has_enrollment
                    and intro_slot_bounds is not None
                ):
                    existing_enrollment_id = session.execute(
                        select(Enrollment.id)
                        .where(
                            Enrollment.instance_id == instance_id_resolved,
                            Enrollment.contact_id == contact.id,
                        )
                        .limit(1)
                    ).scalar_one_or_none()
                    if existing_enrollment_id is None:
                        raise ValidationError(
                            "Enrollment not found for intro-call instance",
                            field="serviceInstanceSlug",
                        )
                    created_enrollment_id = existing_enrollment_id
                    _pay, _, _dup_pi = record_reservation_customer_payment(
                        session,
                        enrollment_id=existing_enrollment_id,
                        contact_id=contact.id,
                        currency=reservation_payload["currency"],
                        total_amount=reservation_payload["total_amount"],
                        payment_method=reservation_payload["payment_method"],
                        stripe_payment_intent_id=reservation_payload.get(
                            "stripe_payment_intent_id"
                        ),
                        stripe_currency=reservation_payload.get("stripe_currency"),
                    )
                    if _dup_pi and _pay is not None:
                        stripe_pi_idempotent_hit = True
                        stripe_pi_existing_payment_id = _pay.id
                    _persist_intro_call_slot_for_enrollment()
                elif not has_enrollment:
                    instance_service_id = resolved_instance.service.id
                    if dc_row is not None:
                        ensure_discount_code_eligible_for_instance(
                            session,
                            discount_code_id=dc_row.id,
                            service_id=instance_service_id,
                            instance_id=instance_id_resolved,
                        )
                    enrollment_row = Enrollment(
                        instance_id=instance_id_resolved,
                        contact_id=contact.id,
                        family_id=None,
                        organization_id=None,
                        ticket_tier_id=None,
                        discount_code_id=None,
                        status=EnrollmentStatus.REGISTERED,
                        amount_paid=reservation_payload["total_amount"],
                        currency=reservation_payload["currency"],
                        notes=None,
                        created_by=_PUBLIC_RESERVATION_ENROLLMENT_ACTOR,
                    )
                    _apply_enrollment_bill_to(
                        enrollment_row,
                        contact_id=contact.id,
                        bill={
                            "bill_to_kind": reservation_payload["bill_to_kind"],
                            "bill_to_contact_id": reservation_payload[
                                "bill_to_contact_id"
                            ],
                            "bill_to_family_id": reservation_payload[
                                "bill_to_family_id"
                            ],
                            "bill_to_organization_id": reservation_payload[
                                "bill_to_organization_id"
                            ],
                        },
                    )
                    created_enrollment, create_err = (
                        enrollment_repo.try_create_enrollment_with_capacity_guard(
                            enrollment_row
                        )
                    )
                    if create_err == "capacity_full":
                        raise ValidationError(
                            "This cohort is full and is not accepting a waitlist for "
                            "public bookings. Your payment was processed; contact support "
                            "if you need a refund.",
                            field="serviceInstanceSlug",
                            status_code=409,
                        )
                    if create_err != "duplicate" and created_enrollment is not None:
                        created_enrollment_id = created_enrollment.id
                        if dc_row is not None:
                            if not discount_repo.validate_and_increment(dc_row.id):
                                session.delete(created_enrollment)
                                session.flush()
                                raise ValidationError(
                                    "Discount code is invalid, inactive, expired, or exhausted",
                                    field="discountCode",
                                )
                            created_enrollment.discount_code_id = dc_row.id
                            session.flush()
                        _pay, _, _dup_pi = record_reservation_customer_payment(
                            session,
                            enrollment_id=created_enrollment.id,
                            contact_id=contact.id,
                            currency=reservation_payload["currency"],
                            total_amount=reservation_payload["total_amount"],
                            payment_method=reservation_payload["payment_method"],
                            stripe_payment_intent_id=reservation_payload.get(
                                "stripe_payment_intent_id"
                            ),
                            stripe_currency=reservation_payload.get("stripe_currency"),
                        )
                        if _dup_pi and _pay is not None:
                            stripe_pi_idempotent_hit = True
                            stripe_pi_existing_payment_id = _pay.id
                        if is_intro_booking and intro_slot_bounds is not None:
                            _persist_intro_call_slot_for_enrollment()

                lead_metadata: dict[str, object] = {
                    "payment_method": reservation_payload["payment_method"],
                    "title": reservation_payload["title"],
                    "locale": reservation_payload["locale"],
                }
                if reservation_payload.get("service_key"):
                    lead_metadata["service_key"] = reservation_payload["service_key"]
                if reservation_payload.get("service_type"):
                    lead_metadata["service_type"] = reservation_payload["service_type"]
                if reservation_payload.get("service_instance_slug"):
                    lead_metadata["service_instance_slug"] = reservation_payload[
                        "service_instance_slug"
                    ]
                if reservation_payload.get("service_instance_cohort"):
                    lead_metadata["service_instance_cohort"] = reservation_payload[
                        "service_instance_cohort"
                    ]
                if reservation_payload.get("booking_system"):
                    lead_metadata["booking_system"] = reservation_payload[
                        "booking_system"
                    ]
                if dc_text and str(dc_text).strip():
                    lead_metadata["discount_code"] = str(dc_text).strip()
                    if dc_row is not None:
                        lead_metadata["discount_code_id"] = str(dc_row.id)
                ma_meta = reservation_payload.get("marketing_attribution")
                if isinstance(ma_meta, dict) and ma_meta:
                    lead_metadata["marketing_attribution"] = ma_meta
                lead = SalesLead(
                    contact_id=contact.id,
                    lead_type=LeadType.PROGRAM_ENROLLMENT,
                    funnel_stage=FunnelStage.NEW,
                )
                lead_repo.create_with_event(
                    lead,
                    LeadEventType.CREATED,
                    metadata=lead_metadata,
                )
                if created_enrollment_id is not None:
                    audit = AuditService(
                        session,
                        user_id=None,
                        request_id=request_id_str or None,
                    )
                    audit.log_custom(
                        table_name="enrollments",
                        record_id=created_enrollment_id,
                        action="PUBLIC_RESERVATION_PERSISTED",
                        new_values={
                            "instance_id": str(instance_id_resolved),
                            "contact_id": str(contact.id),
                        },
                    )
    except ConflictError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except Exception:
        logger.exception("Reservation Aurora persistence failed")
        return json_response(
            500,
            {"error": "Unable to save reservation. Please try again."},
            event=event,
        )

    try:
        _run_reservation_post_success_hooks(reservation_payload)
    except Exception:
        logger.exception("Reservation post-success hooks failed after commit")

    logger.info(
        "Public reservation accepted",
        extra={
            "attendee_email": mask_email(reservation_payload["attendee_email"]),
            "attendee_phone": mask_pii(reservation_payload["attendee_phone"]),
            "title": reservation_payload["title"],
        },
    )

    if stripe_pi_idempotent_hit and stripe_pi_existing_payment_id is not None:
        return json_response(
            200,
            {
                "message": "Reservation submitted",
                "duplicateStripePaymentIntent": True,
                "customerPaymentId": str(stripe_pi_existing_payment_id),
            },
            event=event,
        )

    return json_response(
        202,
        {"message": "Reservation submitted"},
        event=event,
    )


def _run_reservation_post_success_hooks(payload: Mapping[str, Any]) -> None:
    """Transactional email, Mailchimp, and sales recap (best-effort)."""
    email = str(payload.get("attendee_email") or "").strip()
    full_name = str(payload.get("attendee_name") or "").strip()
    locale = normalize_body_locale(payload.get("locale"))
    title = str(payload.get("title") or "").strip() or "Your booking"
    schedule_date = _optional_str(payload.get("schedule_date"))
    schedule_time = _optional_str(payload.get("schedule_time"))
    location_name = _optional_str(payload.get("location_name"))
    location_address = _optional_str(payload.get("location_address"))
    primary_session_iso = _optional_str(payload.get("primary_session_start_iso"))
    primary_session_end_iso = _optional_str(payload.get("primary_session_end_iso"))
    booking_system_for_email = _optional_str(payload.get("booking_system"))
    service_key_for_email = _optional_str(payload.get("service_key"))
    service_type_for_email = _optional_str(payload.get("service_type"))
    service_tier_label = _optional_str(payload.get("service_tier"))
    consultation_focus = _optional_str(payload.get("consultation_writing_focus_label"))
    consultation_level = _optional_str(payload.get("consultation_level_label"))
    session_slots = _session_slots_for_email(payload.get("session_slots"))
    location_url = _optional_str(payload.get("location_url"))
    payment_method = str(payload.get("payment_method") or "").strip() or "unknown"
    total_dec = payload["total_amount"]
    total_amount = f"HK${float(total_dec):,.2f}"
    stripe_pi = _optional_str(payload.get("stripe_payment_intent_id"))
    pm_lower = payment_method.lower()
    is_free = pm_lower == "free"
    is_pending = False if is_free else (pm_lower != "stripe" and not stripe_pi)
    fps_qr_data_url = optional_fps_qr_data_url_from_payload(
        payload.get("fps_qr_image_data_url")
    )

    if email and full_name:
        try:
            send_booking_confirmation_email(
                to_email=email,
                full_name=full_name,
                title=title,
                service_key=service_key_for_email,
                service_type=service_type_for_email,
                schedule_date=schedule_date,
                schedule_time=schedule_time,
                location_name=location_name,
                location_address=location_address,
                primary_session_iso=primary_session_iso,
                primary_session_end_iso=primary_session_end_iso,
                booking_system=booking_system_for_email,
                service_tier_label=service_tier_label,
                payment_method=payment_method,
                total_amount=total_amount,
                is_pending_payment=is_pending,
                locale=locale,
                fps_qr_image_data_url=fps_qr_data_url,
                consultation_writing_focus_label=consultation_focus,
                consultation_level_label=consultation_level,
                session_slots=session_slots,
                location_url=location_url,
                is_free=is_free,
                interested_topics=_optional_str(payload.get("interested_topics")),
            )
        except Exception:
            logger.exception(
                "Unexpected error sending booking confirmation",
                extra={"lead_email": mask_email(email)},
            )

    try:
        booking_tag = mailchimp_booking_tag_from_payload(payload)
        maybe_subscribe_booking_marketing(
            marketing_opt_in=payload.get("marketing_opt_in"),
            email=email,
            full_name=full_name,
            tag_name=booking_tag,
        )
    except Exception:
        logger.exception(
            "Unexpected error in booking marketing subscribe",
            extra={"lead_email": mask_email(email)},
        )

    recap_payload: dict[str, Any] = dict(payload)
    recap_payload.setdefault(
        "phone_region", str(payload.get("phone_region") or "") or None
    )
    recap_payload.setdefault(
        "phone_national_number",
        str(payload.get("phone_national_number") or "") or None,
    )

    send_sales_form_recap_email(
        form_title="Reservation",
        body_lines=build_reservation_recap_lines(payload=recap_payload),
        required=False,
        retry_transient_failures=True,
    )


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _session_slots_for_email(
    raw: Any,
) -> list[dict[str, str]] | None:
    if not isinstance(raw, list) or not raw:
        return None
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        start = item.get("start_iso")
        if not isinstance(start, str) or not start.strip():
            continue
        row: dict[str, str] = {"start_iso": start.strip()}
        end = item.get("end_iso")
        if isinstance(end, str) and end.strip():
            row["end_iso"] = end.strip()
        out.append(row)
    return out or None


def _validate_reservation_payload(body: Mapping[str, Any]) -> dict[str, Any]:
    """Validate reservation payload and return normalized values."""
    booking_system_raw = _optional_text(
        body.get("bookingSystem") or body.get("booking_system"),
        "bookingSystem",
        _MAX_SLUG_KEY_LENGTH,
    )
    booking_system_early = (
        booking_system_raw.strip().lower() if booking_system_raw is not None else None
    )
    is_intro_booking = booking_system_early == "intro-call-booking"

    attendee_name = _require_text(
        body.get("attendeeName"),
        "attendeeName",
        _MAX_NAME_LENGTH,
    )
    attendee_email = validate_email(body.get("attendeeEmail"))
    if attendee_email is None:
        raise ValidationError("attendeeEmail is required", field="attendeeEmail")

    attendee_phone_raw = body.get("attendeePhone")
    attendee_country_raw = body.get("attendeeCountry")
    attendee_country: str | None = None
    if is_intro_booking:
        if attendee_phone_raw is None or str(attendee_phone_raw).strip() == "":
            phone_region, phone_national_number = None, None
            attendee_phone = ""
            attendee_phone_display = ""
        else:
            if attendee_country_raw is None or not str(attendee_country_raw).strip():
                raise ValidationError(
                    "attendeeCountry is required when attendeePhone is provided",
                    field="attendeeCountry",
                )
            attendee_country = validate_phone_region(attendee_country_raw)
            if attendee_country is None:
                raise ValidationError(
                    "attendeeCountry must be a valid ISO region code",
                    field="attendeeCountry",
                )
            attendee_phone = _require_text(
                attendee_phone_raw,
                "attendeePhone",
                _MAX_PHONE_LENGTH,
            )
            phone_region, phone_national_number = validate_phone_fields(
                attendee_country, attendee_phone
            )
            attendee_phone_display = attendee_phone
    else:
        attendee_phone = _require_text(
            attendee_phone_raw,
            "attendeePhone",
            _MAX_PHONE_LENGTH,
        )
        if attendee_country_raw is not None and str(attendee_country_raw).strip():
            attendee_country = validate_phone_region(attendee_country_raw)
            if attendee_country is None:
                raise ValidationError(
                    "attendeeCountry must be a valid ISO region code",
                    field="attendeeCountry",
                )
        parse_region = attendee_country or default_phone_region()
        phone_region, phone_national_number = validate_phone_fields(
            parse_region, attendee_phone
        )
    service_tier = _optional_text(
        body.get("serviceTier"),
        "serviceTier",
        _MAX_LABEL_LENGTH,
    )
    payment_method_raw = body.get("paymentMethod") or body.get("payment_method")
    if is_intro_booking:
        pm_str = str(payment_method_raw or "").strip()
        payment_method = pm_str if pm_str else "free"
    else:
        payment_method = _require_text(
            payment_method_raw,
            "paymentMethod",
            _MAX_PAYMENT_METHOD_LENGTH,
        )
    title = _require_text(
        body.get("title"),
        "title",
        _MAX_LABEL_LENGTH,
    )
    total_amount = _parse_total_amount(body.get("totalAmount"))
    sale_currency = _optional_currency(body.get("currency"))
    stripe_payment_intent_id = _stripe_payment_intent_id_from_body(body)
    schedule_date = _optional_text(
        body.get("scheduleDate"),
        "scheduleDate",
        _MAX_LABEL_LENGTH,
    )
    schedule_time = _optional_text(
        body.get("scheduleTime"),
        "scheduleTime",
        _MAX_LABEL_LENGTH,
    )
    interested_topics = _optional_text(
        body.get("interestedTopics"),
        "interestedTopics",
        _MAX_TOPICS_LENGTH,
    )
    consultation_writing_focus_label = _optional_text(
        body.get("consultationWritingFocusLabel")
        or body.get("consultation_writing_focus_label"),
        "consultationWritingFocusLabel",
        _MAX_LABEL_LENGTH,
    )
    consultation_level_label = _optional_text(
        body.get("consultationLevelLabel") or body.get("consultation_level_label"),
        "consultationLevelLabel",
        _MAX_LABEL_LENGTH,
    )
    comments_field_label = _optional_text(
        body.get("commentsFieldLabel") or body.get("comments_field_label"),
        "commentsFieldLabel",
        _MAX_LABEL_LENGTH,
    )

    cohort_date = _optional_text(
        body.get("cohortDate"),
        "cohortDate",
        _MAX_COHORT_DATE,
    )
    service_key_raw = _require_text(
        body.get("serviceKey"),
        "serviceKey",
        _MAX_SERVICE_KEY_LENGTH,
    )
    service_key = service_key_raw.strip().lower()
    if not _SERVICE_KEY_PATTERN.fullmatch(service_key):
        raise ValidationError(
            "serviceKey must match the public service key pattern",
            field="serviceKey",
        )
    booking_system = booking_system_early
    if (
        booking_system is not None
        and booking_system not in _PUBLIC_RESERVATION_BOOKING_SYSTEM_CODES
    ):
        raise ValidationError(
            "bookingSystem must be one of: consultation-booking, event-booking, "
            "my-best-auntie-booking, intro-call-booking",
            field="bookingSystem",
        )
    location_name = _optional_text(
        body.get("locationName"),
        "locationName",
        _MAX_LOCATION_NAME,
    )
    location_address = _optional_text(
        body.get("locationAddress"),
        "locationAddress",
        _MAX_LOCATION_ADDRESS,
    )
    location_url = _optional_text(
        body.get("locationUrl"),
        "locationUrl",
        _MAX_LOCATION_URL,
    )
    primary_session_start_iso = _optional_text(
        body.get("primarySessionStartIso"),
        "primarySessionStartIso",
        _MAX_ISO_FIELD,
    )
    primary_session_end_iso = _optional_text(
        body.get("primarySessionEndIso"),
        "primarySessionEndIso",
        _MAX_ISO_FIELD,
    )
    session_slots = _parse_session_slots(body.get("sessionSlots"))
    fps_qr_image_data_url = _optional_fps_qr_data_url(body.get("fpsQrImageDataUrl"))
    marketing_opt_in = _parse_bool_opt(body.get("marketingOptIn"), default=False)
    locale = _normalize_locale_field(body.get("locale"))
    discount_code = _optional_text(
        body.get("discountCode"),
        "discountCode",
        _MAX_DISCOUNT_CODE,
    )
    service_instance_slug_raw = _require_text(
        body.get("serviceInstanceSlug"),
        "serviceInstanceSlug",
        _MAX_INSTANCE_SLUG_LENGTH,
    )
    service_instance_slug = service_instance_slug_raw.strip().lower()
    if not PUBLIC_INSTANCE_SLUG_PATTERN.fullmatch(service_instance_slug):
        raise ValidationError(
            "serviceInstanceSlug must match the public slug pattern",
            field="serviceInstanceSlug",
        )
    service_instance_cohort = _optional_text(
        body.get("serviceInstanceCohort") or body.get("service_instance_cohort"),
        "serviceInstanceCohort",
        _MAX_LABEL_LENGTH,
    )
    agreed = body.get("agreedToTermsAndConditions")
    if agreed is not True:
        raise ValidationError(
            "agreedToTermsAndConditions must be true",
            field="agreedToTermsAndConditions",
        )
    reservation_pending = _parse_bool_opt(
        body.get("reservationPendingUntilPaymentConfirmed"),
        default=False,
    )

    pm_lower = payment_method.strip().lower()
    if pm_lower == "free" and total_amount != Decimal("0"):
        raise ValidationError(
            "totalAmount must be 0 when paymentMethod is free",
            field="totalAmount",
        )
    if total_amount == Decimal("0") and pm_lower != "free":
        raise ValidationError(
            "paymentMethod must be free when totalAmount is 0",
            field="paymentMethod",
        )
    if pm_lower == "free":
        reservation_pending = False

    bill = _parse_bill_to_fields(body)
    marketing_attribution = _parse_marketing_attribution(body)

    return {
        "attendee_name": attendee_name,
        "attendee_email": attendee_email,
        "attendee_phone": attendee_phone_display
        if is_intro_booking
        else attendee_phone,
        "attendee_country": attendee_country,
        "phone_region": phone_region,
        "phone_national_number": phone_national_number,
        "service_tier": service_tier,
        "payment_method": payment_method,
        "total_amount": total_amount,
        "currency": sale_currency,
        "title": title,
        "schedule_date": schedule_date,
        "schedule_time": schedule_time,
        "interested_topics": interested_topics,
        "stripe_payment_intent_id": stripe_payment_intent_id,
        "consultation_writing_focus_label": consultation_writing_focus_label,
        "consultation_level_label": consultation_level_label,
        "comments_field_label": comments_field_label,
        "cohort_date": cohort_date,
        "service_key": service_key,
        "booking_system": booking_system,
        "location_name": location_name,
        "location_address": location_address,
        "location_url": location_url,
        "primary_session_start_iso": primary_session_start_iso,
        "primary_session_end_iso": primary_session_end_iso,
        "session_slots": session_slots,
        "fps_qr_image_data_url": fps_qr_image_data_url,
        "marketing_opt_in": marketing_opt_in,
        "locale": locale,
        "discount_code": discount_code,
        "service_instance_slug": service_instance_slug,
        "service_instance_cohort": service_instance_cohort,
        "agreed_to_terms_and_conditions": True,
        "reservation_pending_until_payment_confirmed": reservation_pending,
        "bill_to_kind": bill["bill_to_kind"],
        "bill_to_contact_id": bill["bill_to_contact_id"],
        "bill_to_family_id": bill["bill_to_family_id"],
        "bill_to_organization_id": bill["bill_to_organization_id"],
        "marketing_attribution": marketing_attribution,
    }


def _validate_discount_code_redemption_scope(
    session: Session,
    payload: Mapping[str, Any],
    *,
    resolved_instance: ServiceInstance,
) -> None:
    """Ensure discount code scope matches the reservation context."""
    code = payload.get("discount_code")
    if not code:
        return

    repository = DiscountCodeRepository(session)
    row = repository.get_by_code(str(code))
    if row is None or not discount_code_is_usable_now(row):
        raise ValidationError("Invalid discount code", field="discountCode")

    if row.discount_type == DiscountType.REFERRAL:
        raise ValidationError("Invalid discount code", field="discountCode")

    if row.instance_id is not None:
        if resolved_instance.id != row.instance_id:
            raise ValidationError(
                "Discount code is not valid for this booking",
                field="discountCode",
            )
        return

    if row.service_id is None:
        return

    if resolved_instance.service.id != row.service_id:
        raise ValidationError(
            "Discount code is not valid for this booking",
            field="discountCode",
        )


def _stripe_payment_intent_id_from_body(body: Mapping[str, Any]) -> str | None:
    raw = body.get("stripePaymentIntentId")
    if raw is None:
        raw = body.get("stripe_payment_intent_id")
    if raw is None:
        return None
    return _optional_text(raw, "stripePaymentIntentId", 200)


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


def _validate_payment_confirmation(
    event: Mapping[str, Any],
    reservation_payload: dict[str, Any],
) -> None:
    """Validate Stripe payment confirmation; attach ``stripe_currency`` when Stripe."""
    payment_method = (
        str(reservation_payload.get("payment_method") or "").strip().lower()
    )
    stripe_payment_intent_id = str(
        reservation_payload.get("stripe_payment_intent_id") or ""
    ).strip()

    expects_stripe_payment = "stripe" in payment_method or "apple pay" in payment_method
    if not expects_stripe_payment:
        return

    if not stripe_payment_intent_id:
        raise ValidationError(
            "stripePaymentIntentId is required for Stripe payment method",
            field="stripePaymentIntentId",
        )

    if not _STRIPE_PAYMENT_INTENT_ID_PATTERN.match(stripe_payment_intent_id):
        raise ValidationError(
            "stripePaymentIntentId must be a valid PaymentIntent id",
            field="stripePaymentIntentId",
        )

    stripe_secret_key = resolve_public_www_stripe_secret_key(event)
    if not stripe_secret_key:
        logger.error(
            "Stripe secret key is not configured for reservation payment verification"
        )
        raise ValidationError(
            "Payment verification is unavailable. Please try again later.",
            field="stripePaymentIntentId",
        )

    stripe_intent = _retrieve_stripe_payment_intent(
        stripe_secret_key=stripe_secret_key,
        payment_intent_id=stripe_payment_intent_id,
    )
    _assert_stripe_payment_matches_reservation(
        stripe_intent=stripe_intent,
        reservation_payload=reservation_payload,
    )
    cur = str(stripe_intent.get("currency") or "hkd").upper()[:3]
    reservation_payload["stripe_currency"] = cur


def _retrieve_stripe_payment_intent(
    *,
    stripe_secret_key: str,
    payment_intent_id: str,
) -> Mapping[str, Any]:
    request_url = (
        f"{_STRIPE_PAYMENT_INTENTS_URL_PREFIX}{quote(payment_intent_id, safe='')}"
    )
    try:
        stripe_response = http_invoke(
            method="GET",
            url=request_url,
            headers={
                "Authorization": f"Bearer {stripe_secret_key}",
            },
            timeout=20,
        )
    except AwsProxyError as exc:
        logger.warning(
            "Stripe payment intent retrieval failed via proxy",
            extra={"code": exc.code},
        )
        raise ValidationError(
            "Payment verification failed. Please try again.",
            field="stripePaymentIntentId",
        ) from exc

    status_code = _safe_status_code(stripe_response.get("status"))
    response_body = _parse_response_json(stripe_response.get("body"))
    if status_code != 200 or not isinstance(response_body, Mapping):
        logger.warning(
            "Stripe payment intent retrieval returned unexpected response",
            extra={"status_code": status_code},
        )
        raise ValidationError(
            "Payment verification failed. Please try again.",
            field="stripePaymentIntentId",
        )
    return response_body


def _assert_stripe_payment_matches_reservation(
    *,
    stripe_intent: Mapping[str, Any],
    reservation_payload: Mapping[str, Any],
) -> None:
    intent_status = str(stripe_intent.get("status") or "").strip().lower()
    if intent_status != "succeeded":
        raise ValidationError(
            "Stripe payment is not confirmed",
            field="stripePaymentIntentId",
        )

    try:
        intent_amount_minor_units = int(stripe_intent.get("amount") or 0)
    except (TypeError, ValueError):
        intent_amount_minor_units = 0
    expected_amount_minor_units = int(
        Decimal(str(reservation_payload["total_amount"])) * Decimal("100")
    )
    if intent_amount_minor_units != expected_amount_minor_units:
        raise ValidationError(
            "Stripe payment amount does not match reservation amount",
            field="stripePaymentIntentId",
        )


def _safe_status_code(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _parse_response_json(raw_body: Any) -> Mapping[str, Any] | None:
    if not isinstance(raw_body, str):
        return None
    body = raw_body.strip()
    if not body:
        return None
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, Mapping):
        return parsed
    return None


def _require_text(value: Any, field_name: str, max_length: int) -> str:
    """Validate and require a non-empty string field."""
    normalized = validate_string_length(
        value,
        field_name=field_name,
        max_length=max_length,
        required=True,
    )
    if normalized is None:
        raise ValidationError(f"{field_name} is required", field=field_name)
    return normalized


def _optional_text(value: Any, field_name: str, max_length: int) -> str | None:
    """Validate an optional text field."""
    return validate_string_length(
        value,
        field_name=field_name,
        max_length=max_length,
        required=False,
    )


def _optional_currency(raw: Any) -> str:
    """ISO 4217 currency; default HKD for legacy clients."""
    if raw is None or str(raw).strip() == "":
        return "HKD"
    s = str(raw).strip().upper()
    if len(s) != 3 or not s.isalpha():
        raise ValidationError(
            "currency must be a 3-letter ISO 4217 code",
            field="currency",
        )
    return s


def _parse_total_amount(value: Any) -> Decimal:
    """Validate and normalize total amount."""
    if value is None:
        raise ValidationError("totalAmount is required", field="totalAmount")

    try:
        parsed_amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValidationError(
            "totalAmount must be numeric", field="totalAmount"
        ) from exc

    if parsed_amount < 0:
        raise ValidationError(
            "totalAmount must be greater than or equal to 0",
            field="totalAmount",
        )
    if parsed_amount > _MAX_TOTAL_AMOUNT:
        raise ValidationError(
            "totalAmount exceeds maximum allowed value",
            field="totalAmount",
        )

    return parsed_amount.quantize(Decimal("0.01"))
