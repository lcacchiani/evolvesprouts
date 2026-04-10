"""Lambda handler for processing media requests from SQS."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import (
    Contact,
    ContactSource,
    ContactTag,
    ContactType,
    FunnelStage,
    LeadEventType,
    LeadType,
    MailchimpSyncStatus,
    SalesLead,
    SalesLeadEvent,
    Tag,
)
from app.api.assets.share_links import (
    build_configured_email_download_url,
    generate_share_token,
    resolve_default_allowed_domains,
)
from app.db.repositories.asset import AssetRepository
from app.db.repositories.contact import ContactRepository
from app.db.repositories.sales_lead import SalesLeadRepository
from app.services.email import send_email, send_templated_email
from app.services.mailchimp import (
    MailchimpApiError,
    add_subscriber_with_tag,
    trigger_customer_journey,
)
from app.services.marketing_subscribe import subscribe_to_marketing
from app.templates.media_lead import render_sales_notification_email
from app.utils.logging import configure_logging, get_logger, mask_email
from app.utils.retry import run_with_retry

configure_logging()
logger = get_logger(__name__)

_EVENT_TYPE = "media_request.submitted"
_SYSTEM_ACTOR = "system"
_DEFAULT_MEDIA_NAME = "Free Guide"
_MAX_RESOURCE_KEY_LENGTH = 64
_RESOURCE_KEY_SANITIZE_PATTERN = re.compile(r"[^a-z0-9]+")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process media request messages delivered through SQS."""
    processed = 0
    skipped = 0

    for record in event.get("Records", []):
        try:
            message = _parse_record_message(record)
            if message.get("event_type") != _EVENT_TYPE:
                logger.info(
                    "Skipping unsupported event type",
                    extra={"event_type": message.get("event_type")},
                )
                skipped += 1
                continue

            was_processed = _process_message(message)
            if was_processed:
                processed += 1
            else:
                skipped += 1
        except json.JSONDecodeError as exc:
            logger.error(f"Failed to parse SQS/SNS payload: {exc}")
            raise
        except Exception:
            logger.exception("Failed to process media message")
            raise

    result = {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "skipped": skipped}),
    }
    logger.info(
        "Media processing complete",
        extra={"processed": processed, "skipped": skipped},
    )
    return result


def _parse_record_message(record: dict[str, Any]) -> dict[str, Any]:
    sqs_body = json.loads(record["body"])
    sns_message = sqs_body.get("Message", "{}")
    parsed = json.loads(sns_message)
    if not isinstance(parsed, dict):
        raise ValueError("SNS message payload must be a JSON object")
    return parsed


def _process_message(message: dict[str, Any]) -> bool:
    first_name = _required_text(message.get("first_name"), field="first_name")
    email = _required_email(message.get("email"))
    submitted_at = _normalize_submitted_at(message.get("submitted_at"))
    request_id = _optional_text(message.get("request_id"))
    marketing_opt_in = _parse_marketing_opt_in(message.get("marketing_opt_in"))
    locale = _normalize_email_locale(message.get("locale"))

    with Session(get_engine()) as session:
        resource_key, asset_id, tag_name, media_name = _resolve_media_resource(
            session=session, message=message
        )
        contact_repo = ContactRepository(session)
        sales_lead_repo = SalesLeadRepository(session)

        contact, _ = contact_repo.upsert_by_email(
            email,
            first_name=first_name,
            source=ContactSource.FREE_GUIDE,
            source_detail=_EVENT_TYPE,
            contact_type=ContactType.PARENT,
        )

        existing_lead = sales_lead_repo.find_by_contact_and_asset(
            contact.id,
            LeadType.FREE_GUIDE,
            asset_id,
        )
        if existing_lead is not None:
            _ensure_contact_tag(
                session=session,
                contact_id=contact.id,
                tag_name=tag_name,
            )
            download_url = _ensure_share_link_url_for_asset(
                session=session, asset_id=asset_id
            )
            _send_user_download_email(
                first_name=first_name,
                email=email,
                media_name=media_name,
                download_url=download_url,
                locale=locale,
            )
            was_mailchimp_synced = False
            journey_triggered = False
            if _should_sync_mailchimp_for_media(marketing_opt_in=marketing_opt_in):
                was_mailchimp_synced = _sync_contact_to_mailchimp(
                    contact=contact,
                    first_name=first_name,
                    tag_name=tag_name,
                    merge_fields=_mailchimp_merge_fields_with_download_url(
                        download_url
                    ),
                )
                journey_triggered = (
                    _trigger_mailchimp_journey(email=email)
                    if was_mailchimp_synced
                    else False
                )
            if marketing_opt_in:
                subscribe_to_marketing(
                    email=email,
                    first_name=first_name,
                    tag_name=tag_name,
                    merge_fields=None,
                    logger=logger,
                    subscribe_member=not was_mailchimp_synced,
                )
            logger.info(
                "Skipping duplicate media lead",
                extra={
                    "contact_id": str(contact.id),
                    "lead_id": str(existing_lead.id),
                    "lead_email": mask_email(email),
                    "resource_key": resource_key,
                    "mailchimp_synced": was_mailchimp_synced,
                    "journey_triggered": journey_triggered,
                },
            )
            session.commit()
            return False

        metadata: dict[str, object] = {
            "event_type": _EVENT_TYPE,
            "resource_key": resource_key,
        }
        if request_id:
            metadata["request_id"] = request_id

        lead = SalesLead(
            contact_id=contact.id,
            lead_type=LeadType.FREE_GUIDE,
            funnel_stage=FunnelStage.NEW,
            asset_id=asset_id,
        )
        lead = sales_lead_repo.create_with_event(
            lead,
            LeadEventType.CREATED,
            metadata,
            to_stage=FunnelStage.NEW,
            created_by=_SYSTEM_ACTOR,
        )

        _ensure_contact_tag(
            session=session,
            contact_id=contact.id,
            tag_name=tag_name,
        )
        download_url = _ensure_share_link_url_for_asset(
            session=session, asset_id=asset_id
        )
        _send_user_download_email(
            first_name=first_name,
            email=email,
            media_name=media_name,
            download_url=download_url,
            locale=locale,
        )
        was_mailchimp_synced = False
        journey_triggered = False
        if _should_sync_mailchimp_for_media(marketing_opt_in=marketing_opt_in):
            was_mailchimp_synced = _sync_contact_to_mailchimp(
                contact=contact,
                first_name=first_name,
                tag_name=tag_name,
                merge_fields=_mailchimp_merge_fields_with_download_url(download_url),
            )
            if was_mailchimp_synced:
                journey_triggered = _trigger_mailchimp_journey(email=email)
                mailchimp_meta: dict[str, object] = {
                    "provider": "mailchimp",
                    "resource_key": resource_key,
                    "tag_name": tag_name,
                    "journey_triggered": journey_triggered,
                }
                if download_url:
                    mailchimp_meta["mailchimp_download_url"] = download_url
                _create_sales_lead_event(
                    session=session,
                    lead_id=lead.id,
                    event_type=LeadEventType.EMAIL_SENT,
                    metadata=mailchimp_meta,
                    created_by=_SYSTEM_ACTOR,
                )
        if marketing_opt_in:
            subscribe_to_marketing(
                email=email,
                first_name=first_name,
                tag_name=tag_name,
                merge_fields=None,
                logger=logger,
                subscribe_member=not was_mailchimp_synced,
            )

        _send_sales_notification(
            first_name=first_name,
            email=email,
            media_name=media_name,
            submitted_at=submitted_at,
        )

        session.commit()
        logger.info(
            "Processed media lead",
            extra={
                "contact_id": str(contact.id),
                "lead_id": str(lead.id),
                "lead_email": mask_email(email),
                "resource_key": resource_key,
            },
        )
        return True


def _parse_marketing_opt_in(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def _normalize_email_locale(value: Any) -> str:
    if not isinstance(value, str):
        return "en"
    s = value.strip()
    return s if s in {"en", "zh-CN", "zh-HK"} else "en"


def _should_sync_mailchimp_for_media(*, marketing_opt_in: bool) -> bool:
    flag = os.getenv("MAILCHIMP_REQUIRE_MARKETING_CONSENT", "false").strip().lower()
    if flag == "true":
        return marketing_opt_in
    return True


def _send_user_download_email(
    *,
    first_name: str,
    email: str,
    media_name: str,
    download_url: str | None,
    locale: str,
) -> None:
    from_addr = os.getenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "").strip()
    if not from_addr:
        logger.warning(
            "Skipping user download email: CONFIRMATION_EMAIL_FROM_ADDRESS not set"
        )
        return
    if not download_url:
        logger.warning(
            "Skipping user download email: download URL missing",
            extra={"lead_email": mask_email(email)},
        )
        return
    template = f"evolvesprouts-media-download-{locale}"
    data = {
        "first_name": first_name,
        "media_name": media_name,
        "download_url": download_url,
    }
    try:
        run_with_retry(
            send_templated_email,
            source=from_addr,
            to_addresses=[email],
            template_name=template,
            template_data=data,
            logger=logger,
            operation_name="ses.send_templated_email.media_download",
        )
    except Exception:
        logger.exception(
            "Failed to send media download email",
            extra={"lead_email": mask_email(email), "template": template},
        )


def _mailchimp_merge_fields_with_download_url(
    download_url: str | None,
) -> dict[str, str] | None:
    """Map stable asset share URL into the configured Mailchimp merge field tag."""
    if not download_url:
        return None
    tag = os.getenv("MAILCHIMP_MEDIA_DOWNLOAD_MERGE_TAG", "").strip()
    if not tag:
        return None
    return {tag: download_url}


def _ensure_share_link_url_for_asset(
    *,
    session: Session,
    asset_id: UUID,
) -> str | None:
    """Ensure an asset share link exists and return its public HTTPS URL."""
    repository = AssetRepository(session)
    share_link = repository.get_share_link(asset_id=asset_id)
    if share_link is None:
        try:
            allowed_domains = resolve_default_allowed_domains()
        except RuntimeError:
            logger.warning(
                "Share link defaults unavailable; cannot set Mailchimp download URL",
                extra={"asset_id": str(asset_id)},
            )
            return None
        share_link = repository.create_share_link(
            asset_id=asset_id,
            share_token=generate_share_token(),
            allowed_domains=allowed_domains,
            created_by=_SYSTEM_ACTOR,
        )
        session.flush()

    url = build_configured_email_download_url(share_token=share_link.share_token)
    if not url:
        logger.warning(
            "ASSET_SHARE_LINK_BASE_URL is not set; Mailchimp download URL omitted",
            extra={"asset_id": str(asset_id)},
        )
    return url


def _trigger_mailchimp_journey(*, email: str) -> bool:
    """POST Customer Journey trigger when journey/step env is configured."""
    journey_id = os.getenv("MAILCHIMP_FREE_RESOURCE_JOURNEY_ID", "").strip()
    step_id = os.getenv("MAILCHIMP_FREE_RESOURCE_JOURNEY_STEP_ID", "").strip()
    if not journey_id or not step_id:
        return False
    try:
        run_with_retry(
            trigger_customer_journey,
            email=email,
            journey_id=journey_id,
            step_id=step_id,
            max_attempts=3,
            base_delay_seconds=1.0,
            should_retry=_is_retryable_mailchimp_exception,
            logger=logger,
            operation_name="mailchimp.trigger_customer_journey",
        )
        return True
    except MailchimpApiError as exc:
        logger.warning(
            "Mailchimp journey trigger request failed",
            extra={
                "status": exc.status,
                "lead_email": mask_email(email),
            },
        )
    except Exception:
        logger.exception(
            "Mailchimp journey trigger failed unexpectedly",
            extra={"lead_email": mask_email(email)},
        )
    return False


def _sync_contact_to_mailchimp(
    *,
    contact: Contact,
    first_name: str,
    tag_name: str,
    merge_fields: dict[str, str] | None = None,
) -> bool:
    if not contact.email:
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.warning("Contact email is missing, skipping Mailchimp sync")
        return False

    try:
        mailchimp_response = run_with_retry(
            add_subscriber_with_tag,
            email=contact.email,
            first_name=first_name,
            tag_name=tag_name,
            merge_fields=merge_fields,
            max_attempts=3,
            base_delay_seconds=1.0,
            should_retry=_is_retryable_mailchimp_exception,
            logger=logger,
            operation_name="mailchimp.add_subscriber_with_tag",
        )
        contact.mailchimp_status = MailchimpSyncStatus.SYNCED
        subscriber_id = _optional_text(mailchimp_response.get("id"))
        if subscriber_id:
            contact.mailchimp_subscriber_id = subscriber_id
        return True
    except MailchimpApiError as exc:
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.warning(
            "Mailchimp API request failed",
            extra={
                "status": exc.status,
                "lead_email": mask_email(contact.email),
            },
        )
    except Exception:
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.exception(
            "Mailchimp sync failed unexpectedly",
            extra={"lead_email": mask_email(contact.email)},
        )
    return False


def _is_retryable_mailchimp_exception(exc: Exception) -> bool:
    if isinstance(exc, MailchimpApiError):
        return exc.status == 429 or exc.status >= 500
    return isinstance(exc, (ConnectionError, TimeoutError))


def _create_sales_lead_event(
    *,
    session: Session,
    lead_id: UUID,
    event_type: LeadEventType,
    metadata: dict[str, object] | None = None,
    created_by: str | None = None,
) -> None:
    event = SalesLeadEvent(
        lead_id=lead_id,
        event_type=event_type,
        metadata_json=metadata,
        created_by=created_by,
    )
    session.add(event)
    session.flush()


def _ensure_contact_tag(*, session: Session, contact_id: UUID, tag_name: str) -> None:
    normalized_tag_name = _required_text(tag_name, field="tag_name")

    tag = session.execute(
        select(Tag).where(func.lower(Tag.name) == normalized_tag_name.lower())
    ).scalar_one_or_none()
    if tag is None:
        tag = Tag(
            name=normalized_tag_name,
            created_by=_SYSTEM_ACTOR,
        )
        session.add(tag)
        session.flush()
        session.refresh(tag)

    existing_link = session.execute(
        select(ContactTag).where(
            and_(
                ContactTag.contact_id == contact_id,
                ContactTag.tag_id == tag.id,
            )
        )
    ).scalar_one_or_none()
    if existing_link is None:
        session.add(
            ContactTag(
                contact_id=contact_id,
                tag_id=tag.id,
            )
        )
        session.flush()


def _send_sales_notification(
    *,
    first_name: str,
    email: str,
    media_name: str,
    submitted_at: str,
) -> None:
    sender_email = os.getenv("SES_SENDER_EMAIL", "").strip()
    support_email = os.getenv("SUPPORT_EMAIL", "").strip()
    if not sender_email or not support_email:
        logger.warning(
            "Skipping sales notification email because SES sender/support is missing"
        )
        return

    email_content = render_sales_notification_email(
        first_name=first_name,
        email=email,
        media_name=media_name,
        submitted_at=submitted_at,
    )
    try:
        run_with_retry(
            send_email,
            source=sender_email,
            to_addresses=[support_email],
            subject=email_content.subject,
            body_text=email_content.body_text,
            body_html=email_content.body_html,
            logger=logger,
            operation_name="ses.send_email",
        )
    except Exception:
        logger.exception(
            "Failed to send media sales notification",
            extra={"lead_email": mask_email(email)},
        )


def _resolve_media_resource(
    *,
    session: Session,
    message: dict[str, Any],
) -> tuple[str, UUID, str, str]:
    default_resource_key = _required_media_default_resource_key()
    asset_repository = AssetRepository(session)

    requested_resource_key = _normalize_resource_key(message.get("resource_key"))
    resolved_resource_key = requested_resource_key or default_resource_key
    resolved_asset = asset_repository.find_by_resource_key(resolved_resource_key)
    if resolved_asset is None and resolved_resource_key != default_resource_key:
        logger.warning(
            "Unknown media resource key, using default",
            extra={
                "resource_key": resolved_resource_key,
                "default_resource_key": default_resource_key,
            },
        )
        resolved_resource_key = default_resource_key
        resolved_asset = asset_repository.find_by_resource_key(resolved_resource_key)

    if resolved_asset is None:
        raise RuntimeError(
            f"No media asset found for resource key '{resolved_resource_key}'"
        )

    media_name = _optional_text(resolved_asset.title) or _DEFAULT_MEDIA_NAME

    return (
        resolved_resource_key,
        resolved_asset.id,
        _mailchimp_tag_for_resource(resolved_resource_key),
        media_name,
    )


def _mailchimp_tag_for_resource(resource_key: str) -> str:
    return f"public-www-media-{resource_key}-requested"


def _required_media_default_resource_key() -> str:
    normalized_key = _normalize_resource_key(
        _required_env("MEDIA_DEFAULT_RESOURCE_KEY")
    )
    if normalized_key is None:
        raise RuntimeError("MEDIA_DEFAULT_RESOURCE_KEY must include letters or numbers")
    return normalized_key


def _normalize_resource_key(value: Any) -> str | None:
    normalized_value = _optional_text(value)
    if normalized_value is None:
        return None

    slug = _RESOURCE_KEY_SANITIZE_PATTERN.sub("-", normalized_value.lower()).strip("-")
    slug = slug[:_MAX_RESOURCE_KEY_LENGTH].strip("-")
    return slug or None


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _required_text(value: Any, *, field: str) -> str:
    if not isinstance(value, str):
        value = str(value or "")
    normalized = " ".join(value.split()).strip()
    if not normalized:
        raise ValueError(f"{field} is required")
    return normalized


def _required_email(value: Any) -> str:
    email = _required_text(value, field="email").lower()
    if "@" not in email:
        raise ValueError("email is invalid")
    return email


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _normalize_submitted_at(value: Any) -> str:
    normalized = _optional_text(value)
    if normalized is None:
        return datetime.now(timezone.utc).isoformat()
    return normalized
