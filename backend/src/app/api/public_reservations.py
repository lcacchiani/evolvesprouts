"""Public reservation submission handlers."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from decimal import InvalidOperation
from typing import Any
from collections.abc import Mapping
from urllib.parse import quote
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_email, validate_string_length
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
from app.db.engine import get_engine
from app.db.repositories import DiscountCodeRepository, ServiceRepository
from app.db.models.enums import (
    ContactSource,
    ContactType,
    FunnelStage,
    LeadEventType,
    LeadType,
)
from app.db.models.sales_lead import SalesLead
from app.db.repositories.contact import ContactRepository
from app.db.repositories.sales_lead import SalesLeadRepository
from app.exceptions import ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
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
_MAX_INSTANCE_ID_LENGTH = 36
_MAX_FPS_DATA_URL_BYTES = 120_000
_MAX_TOTAL_AMOUNT = Decimal("1000000")
_STRIPE_PAYMENT_INTENTS_URL_PREFIX = "https://api.stripe.com/v1/payment_intents/"
_STRIPE_PAYMENT_INTENT_ID_PATTERN = re.compile(r"^pi_[A-Za-z0-9]+$")
_ALLOWED_LOCALES = frozenset({"en", "zh-CN", "zh-HK"})


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
        with Session(get_engine()) as session:
            _validate_discount_code_redemption_scope(session, reservation_payload)
            contact_repo = ContactRepository(session)
            lead_repo = SalesLeadRepository(session)
            contact, _created = contact_repo.upsert_by_email(
                reservation_payload["attendee_email"],
                first_name=first_name_from_full_name(
                    reservation_payload["attendee_name"]
                ),
                source=ContactSource.RESERVATION,
                source_detail="public-www-booking",
                contact_type=ContactType.PARENT,
            )
            lead_metadata: dict[str, object] = {
                "payment_method": reservation_payload["payment_method"],
                "course_label": reservation_payload["course_label"],
                "locale": reservation_payload["locale"],
            }
            if reservation_payload.get("service_key"):
                lead_metadata["service_key"] = reservation_payload["service_key"]
            if reservation_payload.get("course_slug"):
                lead_metadata["course_slug"] = reservation_payload["course_slug"]
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
            session.commit()
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
            "course_label": reservation_payload["course_label"],
        },
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
    course_label = str(payload.get("course_label") or "").strip() or "Your booking"
    schedule_date = _optional_str(payload.get("schedule_date_label"))
    schedule_time = _optional_str(payload.get("schedule_time_label"))
    location_name = _optional_str(payload.get("location_name"))
    location_address = _optional_str(payload.get("location_address"))
    primary_session_iso = _optional_str(payload.get("primary_session_start_iso"))
    primary_session_end_iso = _optional_str(payload.get("primary_session_end_iso"))
    course_slug = _optional_str(payload.get("course_slug"))
    age_group_label = _optional_str(payload.get("child_age_group"))
    consultation_focus = _optional_str(payload.get("consultation_writing_focus_label"))
    consultation_level = _optional_str(payload.get("consultation_level_label"))
    course_sessions = _course_sessions_for_email(payload.get("course_sessions"))
    location_url = _optional_str(payload.get("location_url"))
    payment_method = str(payload.get("payment_method") or "").strip() or "unknown"
    total_dec = payload["total_amount"]
    total_amount = f"HK${float(total_dec):,.2f}"
    stripe_pi = _optional_str(payload.get("stripe_payment_intent_id"))
    pm_lower = payment_method.lower()
    is_pending = pm_lower != "stripe" and not stripe_pi
    fps_qr_data_url = optional_fps_qr_data_url_from_payload(
        payload.get("fps_qr_image_data_url")
    )

    if email and full_name:
        try:
            send_booking_confirmation_email(
                to_email=email,
                full_name=full_name,
                course_label=course_label,
                schedule_date_label=schedule_date,
                schedule_time_label=schedule_time,
                location_name=location_name,
                location_address=location_address,
                primary_session_iso=primary_session_iso,
                primary_session_end_iso=primary_session_end_iso,
                course_slug=course_slug,
                age_group_label=age_group_label,
                payment_method=payment_method,
                total_amount=total_amount,
                is_pending_payment=is_pending,
                locale=locale,
                fps_qr_image_data_url=fps_qr_data_url,
                consultation_writing_focus_label=consultation_focus,
                consultation_level_label=consultation_level,
                course_sessions=course_sessions,
                location_url=location_url,
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

    send_sales_form_recap_email(
        form_title="Reservation",
        body_lines=build_reservation_recap_lines(payload=payload),
        required=False,
        retry_transient_failures=True,
    )


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _course_sessions_for_email(
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
    attendee_name = _require_text(
        body.get("attendeeName"),
        "attendeeName",
        _MAX_NAME_LENGTH,
    )
    attendee_email = validate_email(body.get("attendeeEmail"))
    if attendee_email is None:
        raise ValidationError("attendeeEmail is required", field="attendeeEmail")

    attendee_phone = _require_text(
        body.get("attendeePhone"),
        "attendeePhone",
        _MAX_PHONE_LENGTH,
    )
    child_age_group = _require_text(
        body.get("childAgeGroup"),
        "childAgeGroup",
        _MAX_LABEL_LENGTH,
    )
    package_label = _optional_text(
        body.get("packageLabel"),
        "packageLabel",
        _MAX_LABEL_LENGTH,
    )
    month_label = _optional_text(
        body.get("monthLabel"),
        "monthLabel",
        _MAX_LABEL_LENGTH,
    )
    payment_method = _require_text(
        body.get("paymentMethod"),
        "paymentMethod",
        _MAX_PAYMENT_METHOD_LENGTH,
    )
    course_label = _require_text(
        body.get("courseLabel"),
        "courseLabel",
        _MAX_LABEL_LENGTH,
    )
    total_amount = _parse_total_amount(body.get("totalAmount"))
    stripe_payment_intent_id = _stripe_payment_intent_id_from_body(body)
    schedule_date_label = _optional_text(
        body.get("scheduleDateLabel"),
        "scheduleDateLabel",
        _MAX_LABEL_LENGTH,
    )
    schedule_time_label = _optional_text(
        body.get("scheduleTimeLabel"),
        "scheduleTimeLabel",
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
    service_key = _optional_text(
        body.get("serviceKey"),
        "serviceKey",
        _MAX_SLUG_KEY_LENGTH,
    )
    course_slug = _optional_text(
        body.get("courseSlug"),
        "courseSlug",
        _MAX_SLUG_KEY_LENGTH,
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
    course_sessions = _parse_course_sessions(body.get("courseSessions"))
    fps_qr_image_data_url = _optional_fps_qr_data_url(body.get("fpsQrImageDataUrl"))
    marketing_opt_in = _parse_bool_opt(body.get("marketingOptIn"), default=False)
    locale = _normalize_locale_field(body.get("locale"))
    discount_code = _optional_text(
        body.get("discountCode"),
        "discountCode",
        _MAX_DISCOUNT_CODE,
    )
    service_instance_id = _optional_text(
        body.get("serviceInstanceId"),
        "serviceInstanceId",
        _MAX_INSTANCE_ID_LENGTH,
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

    return {
        "attendee_name": attendee_name,
        "attendee_email": attendee_email,
        "attendee_phone": attendee_phone,
        "child_age_group": child_age_group,
        "package_label": package_label,
        "month_label": month_label,
        "payment_method": payment_method,
        "total_amount": total_amount,
        "course_label": course_label,
        "schedule_date_label": schedule_date_label,
        "schedule_time_label": schedule_time_label,
        "interested_topics": interested_topics,
        "stripe_payment_intent_id": stripe_payment_intent_id,
        "consultation_writing_focus_label": consultation_writing_focus_label,
        "consultation_level_label": consultation_level_label,
        "comments_field_label": comments_field_label,
        "cohort_date": cohort_date,
        "service_key": service_key,
        "course_slug": course_slug,
        "location_name": location_name,
        "location_address": location_address,
        "location_url": location_url,
        "primary_session_start_iso": primary_session_start_iso,
        "primary_session_end_iso": primary_session_end_iso,
        "course_sessions": course_sessions,
        "fps_qr_image_data_url": fps_qr_image_data_url,
        "marketing_opt_in": marketing_opt_in,
        "locale": locale,
        "discount_code": discount_code,
        "service_instance_id": service_instance_id,
        "agreed_to_terms_and_conditions": True,
        "reservation_pending_until_payment_confirmed": reservation_pending,
    }


def _resolve_service_id_for_discount_scope(
    session: Session, payload: Mapping[str, Any]
) -> UUID | None:
    service_repo = ServiceRepository(session)
    service_key = payload.get("service_key")
    course_slug = payload.get("course_slug")
    service_key_str = (
        str(service_key).strip() if service_key not in (None, "") else None
    )
    if service_key_str:
        svc = service_repo.get_by_slug(service_key_str)
        return svc.id if svc is not None else None
    slug = str(course_slug).strip().lower() if course_slug not in (None, "") else ""
    if slug:
        svc = service_repo.get_by_slug(slug)
        return svc.id if svc is not None else None
    return None


def _validate_discount_code_redemption_scope(
    session: Session, payload: Mapping[str, Any]
) -> None:
    """Ensure discount code scope matches the reservation context."""
    code = payload.get("discount_code")
    if not code:
        return

    repository = DiscountCodeRepository(session)
    row = repository.get_by_code(str(code))
    if row is None or not discount_code_is_usable_now(row):
        raise ValidationError("Invalid discount code", field="discountCode")

    if row.instance_id is not None:
        raw_instance = payload.get("service_instance_id")
        if not raw_instance:
            raise ValidationError(
                "serviceInstanceId is required for this discount code",
                field="serviceInstanceId",
            )
        try:
            request_instance_id = UUID(str(raw_instance).strip())
        except ValueError as exc:
            raise ValidationError(
                "serviceInstanceId must be a UUID",
                field="serviceInstanceId",
            ) from exc
        if request_instance_id != row.instance_id:
            raise ValidationError(
                "Discount code is not valid for this booking",
                field="discountCode",
            )
        return

    if row.service_id is None:
        return

    resolved = _resolve_service_id_for_discount_scope(session, payload)
    if resolved is None or resolved != row.service_id:
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


def _parse_course_sessions(raw: Any) -> list[dict[str, str]] | None:
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise ValidationError("courseSessions must be an array", field="courseSessions")
    out: list[dict[str, str]] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, Mapping):
            raise ValidationError(
                "courseSessions items must be objects",
                field="courseSessions",
            )
        start = item.get("startIso")
        if not isinstance(start, str) or not start.strip():
            raise ValidationError(
                f"courseSessions[{idx}].startIso is required",
                field="courseSessions",
            )
        start_norm = start.strip()
        if len(start_norm) > _MAX_ISO_FIELD:
            raise ValidationError(
                f"courseSessions[{idx}].startIso is too long",
                field="courseSessions",
            )
        row: dict[str, str] = {"start_iso": start_norm}
        end_raw = item.get("endIso")
        if end_raw is not None:
            if not isinstance(end_raw, str):
                raise ValidationError(
                    f"courseSessions[{idx}].endIso must be a string",
                    field="courseSessions",
                )
            end_norm = end_raw.strip()
            if len(end_norm) > _MAX_ISO_FIELD:
                raise ValidationError(
                    f"courseSessions[{idx}].endIso is too long",
                    field="courseSessions",
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
    reservation_payload: Mapping[str, Any],
) -> None:
    """Validate Stripe payment confirmation details for Stripe reservations."""
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
