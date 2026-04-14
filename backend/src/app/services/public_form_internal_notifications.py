"""Internal SES notifications for public website form submissions.

Includes **sales recaps** (contact, media lead, reservation, legacy booking) to
verified emails on the Cognito group named by ``ADMIN_GROUP`` (default ``admin``),
and **contact_inquiry** notifications to ``SUPPORT_EMAIL``. Module name avoids
implying that recaps are an "admin product" concept.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Mapping
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.services.aws_proxy import AwsProxyError, invoke
from app.services.email import send_email
from app.utils.logging import get_logger, mask_email
from app.utils.retry import run_with_retry

logger = get_logger(__name__)

# IANA tz database id (e.g. Asia/Hong_Kong). Default matches Evolve Sprouts' primary market.
_DEFAULT_SALES_RECAP_DISPLAY_TIMEZONE = "Asia/Hong_Kong"
_ENV_SALES_RECAP_DISPLAY_TIMEZONE = "SALES_RECAP_DISPLAY_TIMEZONE"

_SIGNUP_INTENT_CONTACT_INQUIRY = "contact_inquiry"
_SIGNUP_INTENT_COMMUNITY_NEWSLETTER = "community_newsletter"
_SIGNUP_INTENT_EVENT_NOTIFICATION = "event_notification"


def _emails_from_list_users_response(response: Mapping[str, Any]) -> list[str]:
    found: list[str] = []
    for user in response.get("Users", []):
        attrs = user.get("Attributes", [])
        if not isinstance(attrs, list):
            continue
        for item in attrs:
            if not isinstance(item, Mapping):
                continue
            if item.get("Name") != "email":
                continue
            value = item.get("Value")
            if isinstance(value, str) and value.strip():
                found.append(value.strip().lower())
    return found


def list_sales_recap_recipient_emails() -> list[str]:
    """Return verified lowercased emails for the Cognito group used as sales recap recipients.

    Uses ``ADMIN_GROUP`` (default ``admin``). Today that group is the admin group; naming
    reflects the **sales recap** purpose rather than a generic admin notification.
    """
    pool_id = os.getenv("COGNITO_USER_POOL_ID", "").strip()
    group = os.getenv("ADMIN_GROUP", "admin").strip() or "admin"
    proxy_arn = os.getenv("AWS_PROXY_FUNCTION_ARN", "").strip()
    if not pool_id or not proxy_arn:
        return []
    emails: list[str] = []
    next_token: str | None = None
    while True:
        params: dict[str, Any] = {
            "UserPoolId": pool_id,
            "GroupName": group,
            "Limit": 60,
        }
        if next_token:
            params["NextToken"] = next_token
        try:
            response = invoke("cognito-idp", "list_users_in_group", params)
        except (AwsProxyError, OSError, RuntimeError, TypeError, ValueError) as exc:
            logger.warning(
                "Failed to list Cognito users for sales recap recipient resolution",
                extra={"error": type(exc).__name__},
            )
            return []
        emails.extend(_emails_from_list_users_response(response))
        next_token = response.get("NextToken")
        if not next_token:
            break
    return sorted(set(emails))


def _source_email() -> str:
    return os.getenv("SES_SENDER_EMAIL", "").strip()


def send_contact_inquiry_support_email(*, payload: Mapping[str, Any]) -> None:
    """Notify SUPPORT_EMAIL for full contact-us (contact_inquiry) submissions only."""
    support = os.getenv("SUPPORT_EMAIL", "").strip()
    source = _source_email()
    if not support or not source:
        logger.warning(
            "Skipping contact-inquiry support email: SUPPORT_EMAIL or SES_SENDER_EMAIL missing"
        )
        return
    first_name = str(payload.get("first_name") or "").strip()
    email = str(payload.get("email_address") or "").strip().lower()
    phone = str(payload.get("phone_number") or "").strip()
    message = str(payload.get("message") or "").strip()
    raw_intent = payload.get("signup_intent")
    signup_intent = (
        raw_intent.strip()
        if isinstance(raw_intent, str) and raw_intent.strip()
        else _SIGNUP_INTENT_CONTACT_INQUIRY
    )
    marketing = payload.get("marketing_opt_in")
    locale = str(payload.get("locale") or "").strip() or "(not set)"
    subject = f"[Evolve Sprouts] Contact inquiry: {first_name or email or 'unknown'}"
    body_lines = [
        "A new contact-us inquiry was submitted via the public website.",
        "",
        f"First name: {first_name}",
        f"Email: {email}",
        f"Phone: {phone or '(not provided)'}",
        f"Signup intent: {signup_intent}",
        f"Marketing opt-in: {marketing}",
        f"Locale: {locale}",
        "",
        "Message:",
        message,
    ]
    try:
        send_email(
            source=source,
            to_addresses=[support],
            subject=subject,
            body_text="\n".join(body_lines),
        )
    except Exception:
        logger.exception(
            "Contact inquiry support email failed",
            extra={"lead_email": mask_email(email)},
        )


def _sales_recap_display_timezone() -> ZoneInfo:
    """Resolve IANA timezone for formatting **Submitted at** in sales recap bodies."""
    raw = os.getenv(_ENV_SALES_RECAP_DISPLAY_TIMEZONE, "").strip()
    zone_id = raw or _DEFAULT_SALES_RECAP_DISPLAY_TIMEZONE
    try:
        return ZoneInfo(zone_id)
    except ZoneInfoNotFoundError:
        logger.warning(
            "Invalid sales recap display timezone, using default",
            extra={
                "env": _ENV_SALES_RECAP_DISPLAY_TIMEZONE,
                "zone_id": zone_id,
                "fallback": _DEFAULT_SALES_RECAP_DISPLAY_TIMEZONE,
            },
        )
        return ZoneInfo(_DEFAULT_SALES_RECAP_DISPLAY_TIMEZONE)


def _format_submitted_at_for_recap_display(raw: str) -> str:
    """Format an ISO-like timestamp in the configured display timezone."""
    text = raw.strip()
    if not text:
        return "(not set)"
    normalized = text.replace("Z", "+00:00") if text.endswith("Z") else text
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return text
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tz = _sales_recap_display_timezone()
    local = dt.astimezone(tz)
    abbrev = local.tzname()
    suffix = f" {abbrev}" if abbrev else ""
    return f"{local.strftime('%Y-%m-%d %H:%M:%S')}{suffix}"


def signup_intent_summary(signup_intent: str) -> str:
    if signup_intent == _SIGNUP_INTENT_COMMUNITY_NEWSLETTER:
        return "Community / newsletter signup"
    if signup_intent == _SIGNUP_INTENT_EVENT_NOTIFICATION:
        return "Event notification signup"
    return "Contact inquiry (full form)"


def send_sales_form_recap_email(
    *,
    form_title: str,
    body_lines: list[str],
    required: bool = False,
    retry_transient_failures: bool = False,
) -> None:
    """Send a plain-text sales recap to each address from ``list_sales_recap_recipient_emails``."""
    source = _source_email()
    if not source:
        if required:
            raise RuntimeError("SES_SENDER_EMAIL must be configured")
        logger.warning(
            "Skipping sales form recap: SES_SENDER_EMAIL missing",
            extra={"form": form_title},
        )
        return
    recipients = list_sales_recap_recipient_emails()
    if not recipients:
        if required:
            raise RuntimeError(
                "No sales recap recipients: Cognito group (ADMIN_GROUP) has no verified email addresses"
            )
        logger.warning(
            "Skipping sales form recap: no recipient emails resolved from Cognito",
            extra={"form": form_title},
        )
        return
    subject = f"[Public WWW] {form_title} — recap"
    body_text = "\n".join(body_lines).strip() + "\n"

    def _dispatch_send() -> None:
        if retry_transient_failures:
            run_with_retry(
                send_email,
                source=source,
                to_addresses=recipients,
                subject=subject,
                body_text=body_text,
                logger=logger,
                operation_name="ses.send_email.sales_form_recap",
            )
        else:
            send_email(
                source=source,
                to_addresses=recipients,
                subject=subject,
                body_text=body_text,
            )

    if required:
        _dispatch_send()
        return
    try:
        _dispatch_send()
    except Exception:
        logger.exception(
            "Sales form recap email failed",
            extra={"form": form_title, "recipient_count": len(recipients)},
        )


def build_contact_us_recap_lines(*, payload: Mapping[str, Any]) -> list[str]:
    first_name = str(payload.get("first_name") or "").strip()
    email = str(payload.get("email_address") or "").strip()
    phone = str(payload.get("phone_number") or "").strip()
    message = str(payload.get("message") or "").strip()
    raw_intent = payload.get("signup_intent")
    signup_intent = (
        raw_intent.strip()
        if isinstance(raw_intent, str) and raw_intent.strip()
        else _SIGNUP_INTENT_CONTACT_INQUIRY
    )
    marketing = payload.get("marketing_opt_in")
    locale = str(payload.get("locale") or "").strip() or "(not set)"
    return [
        f"Form: Contact us ({signup_intent_summary(signup_intent)})",
        "",
        f"First name: {first_name}",
        f"Email: {email}",
        f"Phone: {phone or '(not provided)'}",
        f"Signup intent: {signup_intent}",
        f"Marketing opt-in: {marketing}",
        f"Locale: {locale}",
        "",
        "Message:",
        message,
    ]


def build_media_lead_recap_lines(
    *,
    first_name: str,
    email: str,
    media_name: str,
    resource_key: str,
    submitted_at: str,
    marketing_opt_in: bool,
    locale: str,
) -> list[str]:
    return [
        "Form: Media / free resource download",
        "",
        f"First name: {first_name}",
        f"Email: {email}",
        f"Media: {media_name}",
        f"Resource key: {resource_key}",
        f"Submitted at: {_format_submitted_at_for_recap_display(submitted_at)}",
        f"Marketing opt-in: {marketing_opt_in}",
        f"Locale: {locale}",
    ]


def build_reservation_recap_lines(*, payload: Mapping[str, Any]) -> list[str]:
    lines = [
        "Form: Reservation / booking",
        "",
        f"Attendee name: {payload.get('attendee_name', '')}",
        f"Attendee email: {payload.get('attendee_email', '')}",
        f"Attendee phone: {payload.get('attendee_phone', '')}",
        f"Child age group: {payload.get('child_age_group', '')}",
        f"Package: {payload.get('package_label', '')}",
        f"Month: {payload.get('month_label', '')}",
        f"Course: {payload.get('course_label', '')}",
        f"Payment method: {payload.get('payment_method', '')}",
        f"Total amount: {payload.get('total_amount', '')}",
    ]
    stripe_pi = payload.get("stripe_payment_intent_id")
    if stripe_pi:
        lines.append(f"Stripe PaymentIntent ID: {stripe_pi}")
    if payload.get("schedule_date_label"):
        lines.append(f"Schedule date: {payload['schedule_date_label']}")
    if payload.get("schedule_time_label"):
        lines.append(f"Schedule time: {payload['schedule_time_label']}")
    topics = payload.get("interested_topics")
    if topics:
        lines.extend(["", "Interested topics:", str(topics)])
    return lines


def build_booking_legacy_recap_lines(*, payload: Mapping[str, Any]) -> list[str]:
    """Recap lines for legacy reservation JSON (post-upstream success)."""
    full_name = str(payload.get("full_name") or "").strip()
    email = str(payload.get("email") or "").strip()
    course = str(payload.get("course_label") or "").strip() or "(not set)"
    payment = str(payload.get("payment_method") or "").strip() or "(not set)"
    price = payload.get("price")
    locale = str(payload.get("locale") or "").strip() or "(not set)"
    lines = [
        "Form: Booking (legacy API)",
        "",
        f"Name: {full_name}",
        f"Email: {email}",
        f"Course: {course}",
        f"Payment method: {payment}",
        f"Price: {price}",
        f"Locale: {locale}",
    ]
    if payload.get("schedule_date_label"):
        lines.append(f"Schedule date: {payload['schedule_date_label']}")
    if payload.get("schedule_time_label"):
        lines.append(f"Schedule time: {payload['schedule_time_label']}")
    stripe_pi = payload.get("stripe_payment_intent_id")
    if stripe_pi:
        lines.append(f"Stripe PaymentIntent ID: {stripe_pi}")
    return lines
