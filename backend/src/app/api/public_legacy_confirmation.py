"""Post-success transactional email + marketing hooks for legacy public proxy."""

from __future__ import annotations

import os
import re
from typing import Any, Mapping

from app.services.email import send_templated_email
from app.services.marketing_subscribe import subscribe_to_marketing
from app.templates.constants import WHATSAPP_URL, build_faq_url
from app.utils.logging import get_logger, mask_email
from app.utils.public_slug import normalize_public_slug

logger = get_logger(__name__)

_SIGNUP_INTENT_CONTACT_INQUIRY = "contact_inquiry"
_SIGNUP_INTENT_COMMUNITY_NEWSLETTER = "community_newsletter"
_SIGNUP_INTENT_EVENT_NOTIFICATION = "event_notification"
_ALLOWED_SIGNUP_INTENTS = frozenset(
    {
        _SIGNUP_INTENT_CONTACT_INQUIRY,
        _SIGNUP_INTENT_COMMUNITY_NEWSLETTER,
        _SIGNUP_INTENT_EVENT_NOTIFICATION,
    }
)

TAG_PUBLIC_WWW_CONTACT_INQUIRY = "public-www-contact-inquiry"
TAG_PUBLIC_WWW_COMMUNITY_NEWSLETTER = "public-www-community-newsletter"
TAG_PUBLIC_WWW_EVENT_NOTIFICATION = "public-www-event-notification"
TAG_BOOKING_PREFIX = "public-www-booking-customer-"

# Mailchimp FNAME fallback when first_name is empty for community/event tags.
# Public forms normally send deriveFirstNameFromEmailLocalPart + locale fallback;
# this is defensive only (English placeholder if an edge-case request omits FNAME).
_MAILCHIMP_EMAIL_ONLY_FIRST_NAME = "Friend"

_ALLOWED_LOCALES = frozenset({"en", "zh-CN", "zh-HK"})
_LOCALE_HEADER_PATTERN = re.compile(
    r"^(?P<loc>[a-z]{2}(?:-[A-Za-z]{2,4})?)", re.IGNORECASE
)


def resolve_email_locale_from_accept_language(header_value: str) -> str:
    """Pick best locale from Accept-Language; default en."""
    if not header_value or not isinstance(header_value, str):
        return "en"
    for part in header_value.split(","):
        token = part.split(";")[0].strip()
        if not token:
            continue
        match = _LOCALE_HEADER_PATTERN.match(token)
        if not match:
            continue
        raw = match.group("loc")
        normalized = raw.lower()
        if normalized == "zh-cn":
            return "zh-CN"
        if normalized in {"zh-hk", "zh-tw"}:
            return "zh-HK"
        if normalized.startswith("zh"):
            return "zh-HK"
        if normalized.startswith("en"):
            return "en"
    return "en"


def normalize_body_locale(value: Any) -> str:
    """Validate locale from JSON body."""
    if not isinstance(value, str):
        return "en"
    s = value.strip()
    return s if s in _ALLOWED_LOCALES else "en"


def resolve_contact_confirmation_locale(
    *,
    payload: Mapping[str, Any],
    accept_language_header: str,
) -> str:
    """Prefer explicit ``locale`` from the JSON body; fall back to Accept-Language."""
    raw = payload.get("locale")
    if isinstance(raw, str) and raw.strip() in _ALLOWED_LOCALES:
        return raw.strip()
    return resolve_email_locale_from_accept_language(accept_language_header)


def first_name_from_full_name(full_name: str) -> str:
    """Mailchimp FNAME: first whitespace-separated segment, or whole string."""
    normalized = " ".join(str(full_name).split()).strip()
    if not normalized:
        return ""
    return normalized.split(maxsplit=1)[0]


def send_contact_confirmation_email(
    *,
    to_email: str,
    first_name: str,
    locale: str,
) -> None:
    from_addr = os.getenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "").strip()
    if not from_addr:
        logger.warning(
            "CONFIRMATION_EMAIL_FROM_ADDRESS not set; skipping contact confirmation"
        )
        return
    loc = normalize_body_locale(locale)
    template = f"evolvesprouts-contact-confirmation-{loc}"
    faq = build_faq_url(locale=loc)
    data = {
        "first_name": first_name.strip(),
        "whatsapp_url": WHATSAPP_URL,
        "faq_url": faq,
    }
    try:
        send_templated_email(
            source=from_addr,
            to_addresses=[to_email.strip().lower()],
            template_name=template,
            template_data=data,
        )
    except Exception:
        logger.exception(
            "Contact confirmation email failed",
            extra={"lead_email": mask_email(to_email), "template": template},
        )


def send_booking_confirmation_email(
    *,
    to_email: str,
    full_name: str,
    course_label: str,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    payment_method: str,
    total_amount: str,
    is_pending_payment: bool,
    locale: str,
) -> None:
    from_addr = os.getenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "").strip()
    if not from_addr:
        logger.warning(
            "CONFIRMATION_EMAIL_FROM_ADDRESS not set; skipping booking confirmation"
        )
        return
    loc = normalize_body_locale(locale)
    template = f"evolvesprouts-booking-confirmation-{loc}"
    data: dict[str, Any] = {
        "full_name": full_name.strip(),
        "course_label": course_label.strip(),
        "payment_method": payment_method.strip(),
        "total_amount": total_amount,
        "is_pending_payment": is_pending_payment,
        "whatsapp_url": WHATSAPP_URL,
    }
    if schedule_date_label and schedule_date_label.strip():
        data["schedule_date_label"] = schedule_date_label.strip()
    if schedule_time_label and schedule_time_label.strip():
        data["schedule_time_label"] = schedule_time_label.strip()
    try:
        send_templated_email(
            source=from_addr,
            to_addresses=[to_email.strip().lower()],
            template_name=template,
            template_data=data,
        )
    except Exception:
        logger.exception(
            "Booking confirmation email failed",
            extra={"lead_email": mask_email(to_email), "template": template},
        )


def mailchimp_tag_for_contact_signup_intent(signup_intent: str | None) -> str:
    """Map ``signup_intent`` to the Mailchimp audience tag (public-www-*)."""
    normalized = (signup_intent or "").strip()
    if normalized == _SIGNUP_INTENT_COMMUNITY_NEWSLETTER:
        return TAG_PUBLIC_WWW_COMMUNITY_NEWSLETTER
    if normalized == _SIGNUP_INTENT_EVENT_NOTIFICATION:
        return TAG_PUBLIC_WWW_EVENT_NOTIFICATION
    return TAG_PUBLIC_WWW_CONTACT_INQUIRY


def mailchimp_booking_tag_from_payload(payload: Mapping[str, Any]) -> str:
    """Build ``public-www-booking-customer-{slug}`` from stable booking identifiers."""
    service_key = normalize_public_slug(payload.get("service_key"))
    course_slug = normalize_public_slug(payload.get("course_slug"))
    slug_part = service_key or course_slug or "unknown"
    return f"{TAG_BOOKING_PREFIX}{slug_part}"


def maybe_subscribe_contact_us_marketing(
    *,
    marketing_opt_in: Any,
    email: str,
    first_name: str,
    tag_name: str,
) -> None:
    if not _truthy_opt_in(marketing_opt_in):
        return
    fn = " ".join(str(first_name).split()).strip()
    if not fn:
        if tag_name in (
            TAG_PUBLIC_WWW_COMMUNITY_NEWSLETTER,
            TAG_PUBLIC_WWW_EVENT_NOTIFICATION,
        ):
            fn = _MAILCHIMP_EMAIL_ONLY_FIRST_NAME
        else:
            return
    subscribe_to_marketing(
        email=email,
        first_name=fn,
        tag_name=tag_name,
        merge_fields=None,
        logger=logger,
    )


def maybe_subscribe_booking_marketing(
    *,
    marketing_opt_in: Any,
    email: str,
    full_name: str,
    tag_name: str,
) -> None:
    if not _truthy_opt_in(marketing_opt_in):
        return
    fn = first_name_from_full_name(full_name)
    if not fn:
        return
    subscribe_to_marketing(
        email=email,
        first_name=fn,
        tag_name=tag_name,
        merge_fields=None,
        logger=logger,
    )


def _truthy_opt_in(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def run_contact_us_post_success(
    *, event: Mapping[str, Any], payload: Mapping[str, Any]
) -> None:
    accept_lang = _get_header_case_insensitive(event, "accept-language")
    locale = resolve_contact_confirmation_locale(
        payload=payload,
        accept_language_header=accept_lang,
    )
    email = str(payload.get("email_address") or "").strip()
    first_name = str(payload.get("first_name") or "").strip()
    raw_intent = payload.get("signup_intent")
    signup_intent = (
        raw_intent.strip()
        if isinstance(raw_intent, str) and raw_intent.strip()
        else _SIGNUP_INTENT_CONTACT_INQUIRY
    )
    if signup_intent not in _ALLOWED_SIGNUP_INTENTS:
        signup_intent = _SIGNUP_INTENT_CONTACT_INQUIRY
    mailchimp_tag = mailchimp_tag_for_contact_signup_intent(signup_intent)
    is_email_only_intent = signup_intent in {
        _SIGNUP_INTENT_COMMUNITY_NEWSLETTER,
        _SIGNUP_INTENT_EVENT_NOTIFICATION,
    }
    if email and first_name and not is_email_only_intent:
        try:
            send_contact_confirmation_email(
                to_email=email,
                first_name=first_name,
                locale=locale,
            )
        except Exception:
            logger.exception(
                "Unexpected error sending contact confirmation",
                extra={"lead_email": mask_email(email)},
            )
    try:
        maybe_subscribe_contact_us_marketing(
            marketing_opt_in=payload.get("marketing_opt_in"),
            email=email,
            first_name=first_name,
            tag_name=mailchimp_tag,
        )
    except Exception:
        logger.exception(
            "Unexpected error in contact marketing subscribe",
            extra={"lead_email": mask_email(email)},
        )


def run_reservation_post_success(*, payload: Mapping[str, Any]) -> None:
    email = str(payload.get("email") or "").strip()
    full_name = str(payload.get("full_name") or "").strip()
    locale = normalize_body_locale(payload.get("locale"))
    course_label = str(payload.get("course_label") or "").strip()
    if not course_label:
        course_label = "Your booking"
    schedule_date = _optional_str(payload.get("schedule_date_label"))
    schedule_time = _optional_str(payload.get("schedule_time_label"))
    payment_method = str(payload.get("payment_method") or "").strip() or "unknown"
    price = payload.get("price")
    total_amount = _format_hkd_amount(price)
    stripe_pi = _optional_str(payload.get("stripe_payment_intent_id"))
    pm_lower = payment_method.lower()
    is_pending = pm_lower != "stripe" and not stripe_pi
    if email and full_name:
        try:
            send_booking_confirmation_email(
                to_email=email,
                full_name=full_name,
                course_label=course_label,
                schedule_date_label=schedule_date,
                schedule_time_label=schedule_time,
                payment_method=payment_method,
                total_amount=total_amount,
                is_pending_payment=is_pending,
                locale=locale,
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


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _format_hkd_amount(price: Any) -> str:
    try:
        n = float(price)
    except (TypeError, ValueError):
        return "HK$0.00"
    return f"HK${n:.2f}"


def _get_header_case_insensitive(event: Mapping[str, Any], name: str) -> str:
    headers = event.get("headers") or {}
    if not isinstance(headers, Mapping):
        return ""
    target_name = name.lower()
    for key, value in headers.items():
        if str(key).lower() == target_name:
            normalized_value = str(value).strip()
            if normalized_value:
                return normalized_value
            return ""
    return ""
