"""Field parsing and validation for public reservation submissions."""

from __future__ import annotations

import re
from collections.abc import Mapping
from decimal import Decimal
from decimal import InvalidOperation
from typing import Any
from uuid import UUID

from app.api.public_reservations_stripe import _stripe_payment_intent_id_from_body
from app.api.text_fields import (
    optional_text as _optional_text,
    require_text as _require_text,
)
from app.api.validators import (
    validate_email,
    validate_phone_fields,
    validate_phone_region,
)
from app.db.models.enums import BillingBillToKind
from app.exceptions import ValidationError
from app.utils.phone import default_phone_region
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN

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
_ALLOWED_LOCALES = frozenset({"en", "zh-CN", "zh-HK"})
_MAX_SERVICE_KEY_LENGTH = 80
_SERVICE_KEY_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_INTRO_CALL_SERVICE_KEY = "intro-call"
_ALLOWED_CONSULTATION_SERVICE_KEYS = frozenset(
    {"family-consultation-essentials", "family-consultation-deep-dive"}
)
_PUBLIC_RESERVATION_BOOKING_SYSTEM_CODES = frozenset(
    {
        "consultation-booking",
        "event-booking",
        "my-best-auntie-booking",
        "intro-call-booking",
    }
)
_PER_BOOKING_BOOKING_SYSTEMS = frozenset({"consultation-booking", "intro-call-booking"})
_MAX_MARKETING_ATTRIBUTION_UTM_SOURCE = 100
_MAX_MARKETING_ATTRIBUTION_UTM_MEDIUM = 100
_MAX_MARKETING_ATTRIBUTION_UTM_CAMPAIGN = 200
_MAX_MARKETING_ATTRIBUTION_UTM_CONTENT = 200
_MAX_MARKETING_ATTRIBUTION_REFERRER = 500


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


def _validate_reservation_payload(body: Mapping[str, Any]) -> dict[str, Any]:
    """Validate reservation payload and return normalized values."""
    from app.api.public_reservations_persistence import (
        _normalize_locale_field,
        _optional_fps_qr_data_url,
        _parse_bool_opt,
        _parse_session_slots,
    )

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
    per_booking_slug_optional = booking_system_early in _PER_BOOKING_BOOKING_SYSTEMS
    service_instance_slug: str | None = None
    if per_booking_slug_optional:
        raw_inst_slug = body.get("serviceInstanceSlug")
        if raw_inst_slug is not None and str(raw_inst_slug).strip():
            service_instance_slug_raw = _require_text(
                raw_inst_slug,
                "serviceInstanceSlug",
                _MAX_INSTANCE_SLUG_LENGTH,
            )
            service_instance_slug_norm = service_instance_slug_raw.strip().lower()
            if not PUBLIC_INSTANCE_SLUG_PATTERN.fullmatch(service_instance_slug_norm):
                raise ValidationError(
                    "serviceInstanceSlug must match the public slug pattern",
                    field="serviceInstanceSlug",
                )
            service_instance_slug = service_instance_slug_norm
    else:
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
