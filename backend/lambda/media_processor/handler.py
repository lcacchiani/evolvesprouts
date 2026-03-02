"""Lambda handler for processing media requests from SQS."""

from __future__ import annotations

import json
import os
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
from app.db.repositories.contact import ContactRepository
from app.db.repositories.sales_lead import SalesLeadRepository
from app.services.email import send_email
from app.services.mailchimp import MailchimpApiError, add_subscriber_with_tag
from app.templates.media_lead import render_sales_notification_email
from app.utils.logging import configure_logging, get_logger, mask_email
from app.utils.retry import run_with_retry

configure_logging()
logger = get_logger(__name__)

_EVENT_TYPE = "media_request.submitted"
_SYSTEM_ACTOR = "system"
_DEFAULT_MEDIA_NAME = "4 Ways to Teach Patience to Young Children"


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

    tag_name = _required_env("MEDIA_TAG")
    asset_id = _required_uuid_env("FOUR_WAYS_PATIENCE_FREE_GUIDE_ASSET_ID")

    with Session(get_engine()) as session:
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
            logger.info(
                "Skipping duplicate media lead",
                extra={
                    "contact_id": str(contact.id),
                    "lead_id": str(existing_lead.id),
                    "lead_email": mask_email(email),
                },
            )
            session.commit()
            return False

        metadata: dict[str, object] = {"event_type": _EVENT_TYPE}
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

        _ensure_contact_tag(session, contact_id=contact.id, tag_name=tag_name)
        was_mailchimp_synced = _sync_contact_to_mailchimp(
            contact=contact,
            first_name=first_name,
            tag_name=tag_name,
        )
        if was_mailchimp_synced:
            _create_sales_lead_event(
                session=session,
                lead_id=lead.id,
                event_type=LeadEventType.EMAIL_SENT,
                metadata={
                    "provider": "mailchimp",
                    "tag_name": tag_name,
                },
                created_by=_SYSTEM_ACTOR,
            )

        _send_sales_notification(
            first_name=first_name,
            email=email,
            submitted_at=submitted_at,
        )

        session.commit()
        logger.info(
            "Processed media lead",
            extra={
                "contact_id": str(contact.id),
                "lead_id": str(lead.id),
                "lead_email": mask_email(email),
            },
        )
        return True


def _sync_contact_to_mailchimp(
    *,
    contact: Contact,
    first_name: str,
    tag_name: str,
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
        media_name=_DEFAULT_MEDIA_NAME,
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


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _required_uuid_env(name: str) -> UUID:
    value = _required_env(name)
    try:
        return UUID(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid UUID for {name}") from exc


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
