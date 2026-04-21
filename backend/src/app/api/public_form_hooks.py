"""Post-success transactional email, marketing, and internal notifications for public forms."""

from __future__ import annotations

import os
import re
from typing import Any, Mapping

from app.services.email import (
    send_mime_email_with_optional_attachments,
    send_templated_email,
)
from app.services.public_form_internal_notifications import (
    build_contact_us_recap_lines,
    send_sales_form_recap_email,
    send_contact_inquiry_support_email,
)
from app.services.marketing_subscribe import subscribe_to_marketing
from app.templates.booking_confirmation_content import BOOKING_ICS_ATTACHMENT_FILENAME
from app.templates.booking_confirmation_render import (
    booking_confirmation_template_merge_data,
    build_booking_confirmation_ics,
    format_booking_location_display_line,
    render_booking_confirmation_email,
    substitute_shell_placeholders,
)
from app.templates.constants import build_faq_url
from app.templates.transactional_shell_data import (
    merge_transactional_shell_template_data,
    resolve_whatsapp_url_for_template,
)
from app.utils.fps_qr_png import (
    decode_fps_qr_png_data_url,
)
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
# Public forms normally send email-derived first_name + locale fallback;
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
    data = merge_transactional_shell_template_data(
        locale=loc,
        template_data={
            "first_name": first_name.strip(),
            "whatsapp_url": resolve_whatsapp_url_for_template(),
            "faq_url": faq,
        },
    )
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
    location_name: str | None = None,
    location_address: str | None = None,
    primary_session_iso: str | None = None,
    primary_session_end_iso: str | None = None,
    course_slug: str | None = None,
    age_group_label: str | None = None,
    payment_method: str,
    total_amount: str,
    is_pending_payment: bool,
    locale: str,
    fps_qr_image_data_url: str | None = None,
    consultation_writing_focus_label: str | None = None,
    consultation_level_label: str | None = None,
    course_sessions: list[dict[str, str]] | None = None,
    location_url: str | None = None,
    is_free: bool = False,
) -> None:
    from_addr = os.getenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "").strip()
    if not from_addr:
        logger.warning(
            "CONFIRMATION_EMAIL_FROM_ADDRESS not set; skipping booking confirmation"
        )
        return
    loc = normalize_body_locale(locale)
    template = f"evolvesprouts-booking-confirmation-{loc}"
    data: dict[str, Any] = booking_confirmation_template_merge_data(
        locale=loc,
        full_name=full_name,
        course_label=course_label,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_name=location_name,
        location_address=location_address,
        primary_session_iso=primary_session_iso,
        primary_session_end_iso=primary_session_end_iso,
        course_slug=course_slug,
        age_group_label=age_group_label,
        payment_method_code=payment_method,
        total_amount=total_amount,
        is_pending_payment=is_pending_payment,
        whatsapp_url=resolve_whatsapp_url_for_template(),
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
        course_sessions=course_sessions,
        location_url=location_url,
        is_free=is_free,
    )

    loc_line_for_ics = format_booking_location_display_line(
        location_name=location_name,
        location_address=location_address,
    )
    ics_bytes = build_booking_confirmation_ics(
        course_label=course_label,
        primary_session_iso=primary_session_iso,
        primary_session_end_iso=primary_session_end_iso,
        location_line=loc_line_for_ics,
        course_slug=course_slug,
    )
    if ics_bytes is not None:
        data["include_calendar_note_after_schedule_html"] = True
        data["include_calendar_note_after_schedule_plain"] = True
        data["include_calendar_fallback_hint_html"] = False
        data["include_calendar_fallback_hint_plain"] = False

    merged = merge_transactional_shell_template_data(locale=loc, template_data=data)

    pm_lower = payment_method.lower().strip()
    png_bytes: bytes | None = None
    if (
        not is_free
        and is_pending_payment
        and pm_lower == "fps_qr"
        and isinstance(fps_qr_image_data_url, str)
        and fps_qr_image_data_url.strip()
    ):
        png_bytes = decode_fps_qr_png_data_url(fps_qr_image_data_url)
        if png_bytes is None:
            logger.warning(
                "Invalid fps_qr_image_data_url for booking confirmation; "
                "falling back to template without inline QR",
                extra={"lead_email": mask_email(to_email)},
            )

    use_mime_path = png_bytes is not None or ics_bytes is not None

    if use_mime_path:
        wa_url = str(merged.get("whatsapp_url") or "").strip()
        faq_url = str(merged.get("faq_url") or "").strip()
        attach_ics = ics_bytes is not None
        subject, html_doc, plain_text = render_booking_confirmation_email(
            locale=loc,
            full_name=full_name,
            course_label=course_label,
            schedule_date_label=schedule_date_label,
            schedule_time_label=schedule_time_label,
            location_name=location_name,
            location_address=location_address,
            primary_session_iso=primary_session_iso,
            primary_session_end_iso=primary_session_end_iso,
            course_slug=course_slug,
            age_group_label=age_group_label,
            payment_method_code=payment_method,
            total_amount=total_amount,
            is_pending_payment=is_pending_payment,
            whatsapp_url=wa_url,
            faq_url=faq_url,
            include_fps_qr_image=png_bytes is not None,
            consultation_writing_focus_label=consultation_writing_focus_label,
            consultation_level_label=consultation_level_label,
            attach_calendar_invite_ics=attach_ics,
            course_sessions=course_sessions,
            location_url=location_url,
            is_free=is_free,
        )
        full_html = substitute_shell_placeholders(html_doc, merged)
        attachments: list[tuple[str, str, bytes]] | None = None
        if ics_bytes is not None:
            attachments = [
                (
                    BOOKING_ICS_ATTACHMENT_FILENAME,
                    "text/calendar; charset=utf-8; method=PUBLISH",
                    ics_bytes,
                )
            ]
        try:
            send_mime_email_with_optional_attachments(
                source=from_addr,
                to_addresses=[to_email.strip().lower()],
                subject=subject,
                body_text=plain_text,
                body_html=full_html,
                inline_image_cid="fps_qr" if png_bytes is not None else None,
                png_bytes=png_bytes,
                attachments=attachments,
            )
        except Exception:
            logger.exception(
                "Booking confirmation email failed (MIME path)",
                extra={"lead_email": mask_email(to_email)},
            )
        return

    try:
        send_templated_email(
            source=from_addr,
            to_addresses=[to_email.strip().lower()],
            template_name=template,
            template_data=merged,
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
    service_key = normalize_public_slug(
        payload.get("service_key") or payload.get("serviceKey")
    )
    course_slug = normalize_public_slug(
        payload.get("course_slug") or payload.get("courseSlug")
    )
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
    send_sales_form_recap_email(
        form_title="Contact us",
        body_lines=build_contact_us_recap_lines(payload=payload),
    )
    if signup_intent == _SIGNUP_INTENT_CONTACT_INQUIRY:
        send_contact_inquiry_support_email(payload=payload)


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
