"""Shared Mailchimp ↔ CRM contact sync helpers (media processor + admin batch)."""

from __future__ import annotations

import logging
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.db.models.contact import Contact
from app.db.models.enums import MailchimpSyncStatus
from app.services.mailchimp import (
    MailchimpApiError,
    add_subscriber_with_tag,
    archive_subscriber,
    permanent_delete_subscriber,
)
from app.utils.logging import ContextLogger, mask_email
from app.utils.retry import run_with_retry

LoggerLike = logging.Logger | ContextLogger


def is_retryable_mailchimp_exception(exc: Exception) -> bool:
    if isinstance(exc, MailchimpApiError):
        return exc.status == 429 or exc.status >= 500
    return isinstance(exc, (ConnectionError, TimeoutError))


def _optional_subscriber_id(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def upsert_contact_to_mailchimp(
    *,
    contact: Contact,
    tag_name: str,
    merge_fields: dict[str, str] | None = None,
    logger: LoggerLike,
    session: Session | None = None,
) -> tuple[Literal["synced", "skipped", "failed"], int | None]:
    """Push one contact to Mailchimp with tag; updates ``contact`` mailchimp fields.

    Returns ``(outcome, http_status)`` where ``http_status`` is set on Mailchimp API failure.
    """
    if session is not None:
        session.refresh(contact, attribute_names=["mailchimp_status", "archived_at"])

    if not contact.email or not str(contact.email).strip():
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.warning("Contact email is missing, skipping Mailchimp sync")
        return "skipped", None

    if contact.archived_at is not None:
        return "skipped", None

    if contact.mailchimp_status == MailchimpSyncStatus.UNSUBSCRIBED:
        return "skipped", None

    first_name = " ".join((contact.first_name or "").split()).strip()
    if not first_name:
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.warning(
            "Contact first_name is missing, skipping Mailchimp sync",
            extra={"lead_email": mask_email(contact.email)},
        )
        return "skipped", None

    try:
        mailchimp_response = run_with_retry(
            add_subscriber_with_tag,
            email=contact.email,
            first_name=first_name,
            tag_name=tag_name,
            merge_fields=merge_fields,
            max_attempts=3,
            base_delay_seconds=1.0,
            should_retry=is_retryable_mailchimp_exception,
            logger=logger,
            operation_name="mailchimp.add_subscriber_with_tag",
        )
        contact.mailchimp_status = MailchimpSyncStatus.SYNCED
        subscriber_id = _optional_subscriber_id(mailchimp_response.get("id"))
        if subscriber_id:
            contact.mailchimp_subscriber_id = subscriber_id
        return "synced", None
    except MailchimpApiError as exc:
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.warning(
            "Mailchimp API request failed",
            extra={
                "status": exc.status,
                "lead_email": mask_email(contact.email),
            },
        )
        return "failed", exc.status
    except Exception:
        contact.mailchimp_status = MailchimpSyncStatus.FAILED
        logger.exception(
            "Mailchimp sync failed unexpectedly",
            extra={"lead_email": mask_email(contact.email)},
        )
        return "failed", None


def remove_contact_from_mailchimp(
    *,
    email: str,
    mode: Literal["archive", "permanent"] = "archive",
    logger: LoggerLike,
) -> Literal["removed", "skipped", "failed"]:
    """Remove one email from Mailchimp (archive or permanent). Caller clears DB row."""
    normalized = (email or "").strip().lower()
    if not normalized:
        return "skipped"

    op = permanent_delete_subscriber if mode == "permanent" else archive_subscriber

    try:
        run_with_retry(
            op,
            email=normalized,
            max_attempts=3,
            base_delay_seconds=1.0,
            should_retry=is_retryable_mailchimp_exception,
            logger=logger,
            operation_name=(
                "mailchimp.permanent_delete_subscriber"
                if mode == "permanent"
                else "mailchimp.archive_subscriber"
            ),
        )
        return "removed"
    except MailchimpApiError as exc:
        logger.warning(
            "Mailchimp remove request failed",
            extra={
                "status": exc.status,
                "lead_email": mask_email(normalized),
            },
        )
    except Exception:
        logger.exception(
            "Mailchimp remove failed unexpectedly",
            extra={"lead_email": mask_email(normalized)},
        )
    return "failed"
