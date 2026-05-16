"""Admin Mailchimp bulk sync and orphan cleanup endpoints."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_entities_helpers import request_id
from app.api.admin_request import encode_cursor, parse_body, parse_cursor
from app.api.admin_validators import validate_string_length
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models.enums import MailchimpSyncStatus
from app.db.repositories import ContactRepository
from app.exceptions import ValidationError
from app.services.mailchimp import ITER_AUDIENCE_MEMBER_FIELDS, iter_audience_members
from app.services.mailchimp_sync import (
    _mailchimp_audience_env_configured,
    _mailchimp_runtime_ready,
    remove_contact_from_mailchimp,
    upsert_contact_to_mailchimp,
)
from app.utils import json_response
from app.utils.deployment import is_production
from app.utils.logging import get_logger, mask_email

logger = get_logger(__name__)

_TAG_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9 ._\-]{1,100}$")
_ALLOWED_SYNC_STATUSES = frozenset(
    {
        MailchimpSyncStatus.PENDING,
        MailchimpSyncStatus.FAILED,
    }
)


def _require_production_mailchimp_or_409(
    event: Mapping[str, Any],
) -> dict[str, Any] | None:
    if _mailchimp_runtime_ready():
        return None
    if not is_production():
        return json_response(
            409,
            {
                "error": (
                    "Mailchimp bulk sync is only available when DEPLOYMENT_STAGE is production"
                )
            },
            event=event,
        )
    if not _mailchimp_audience_env_configured():
        return json_response(
            409,
            {
                "error": (
                    "MAILCHIMP_LIST_ID and MAILCHIMP_SERVER_PREFIX must be configured "
                    "for Mailchimp bulk operations"
                )
            },
            event=event,
        )


def _parse_tag_name(raw: Any) -> str:
    tag = validate_string_length(
        raw,
        "tag_name",
        max_length=100,
        required=True,
    )
    if tag is None or not str(tag).strip():
        raise ValidationError("tag_name is required", field="tag_name")
    normalized = str(tag).strip()
    if not _TAG_NAME_PATTERN.fullmatch(normalized):
        raise ValidationError(
            "tag_name must be 1–100 characters of letters, digits, spaces, hyphens, dots, or underscores",
            field="tag_name",
        )
    return normalized


def _parse_mailchimp_offset(raw: Any) -> int:
    if raw is None:
        return 0
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            "mailchimp_offset must be an integer", field="mailchimp_offset"
        ) from exc
    if value < 0 or value > 10_000_000:
        raise ValidationError(
            "mailchimp_offset must be between 0 and 10000000",
            field="mailchimp_offset",
        )
    return value


def _parse_max_contacts(raw: Any, *, field: str, default: int, cap: int) -> int:
    if raw is None:
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be an integer", field=field) from exc
    if value < 1 or value > cap:
        raise ValidationError(f"{field} must be between 1 and {cap}", field=field)
    return value


def _parse_only_statuses(raw: Any) -> list[MailchimpSyncStatus]:
    if raw is None:
        return [MailchimpSyncStatus.PENDING, MailchimpSyncStatus.FAILED]
    if not isinstance(raw, list):
        raise ValidationError("only_statuses must be an array", field="only_statuses")
    if not raw:
        raise ValidationError("only_statuses cannot be empty", field="only_statuses")
    parsed: list[MailchimpSyncStatus] = []
    for item in raw:
        if not isinstance(item, str):
            raise ValidationError(
                "only_statuses entries must be strings", field="only_statuses"
            )
        key = item.strip().lower()
        try:
            status = MailchimpSyncStatus(key)
        except ValueError as exc:
            raise ValidationError(
                f"Invalid mailchimp_status filter: {item}", field="only_statuses"
            ) from exc
        if status == MailchimpSyncStatus.UNSUBSCRIBED:
            raise ValidationError(
                "only_statuses cannot include unsubscribed (would risk re-subscribing)",
                field="only_statuses",
            )
        if status not in _ALLOWED_SYNC_STATUSES:
            raise ValidationError(
                f"only_statuses cannot include {status.value}", field="only_statuses"
            )
        parsed.append(status)
    return parsed


def run_mailchimp_sync_batch(
    event: Mapping[str, Any],
    *,
    actor_sub: str,
) -> dict[str, Any]:
    err = _require_production_mailchimp_or_409(event)
    if err is not None:
        return err

    body = parse_body(event)
    max_contacts = _parse_max_contacts(
        body.get("max_contacts"), field="max_contacts", default=50, cap=200
    )
    cursor_raw = body.get("cursor")
    cursor: UUID | None = None
    if cursor_raw not in (None, ""):
        if not isinstance(cursor_raw, str):
            raise ValidationError("cursor must be a string", field="cursor")
        cursor = parse_cursor(cursor_raw)
    only_statuses = _parse_only_statuses(body.get("only_statuses"))
    tag_name = _parse_tag_name(body.get("tag_name"))
    dry_run = bool(body.get("dry_run", False))

    fetch_limit = max_contacts + 1
    errors_sample: list[dict[str, Any]] = []

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ContactRepository(session)
        rows = repository.list_for_mailchimp_sync(
            limit=fetch_limit,
            cursor=cursor,
            statuses=only_statuses,
        )
        page = rows[:max_contacts]
        has_more = len(rows) > max_contacts
        next_cursor = encode_cursor(page[-1].id) if has_more and page else None

        processed = 0
        succeeded = 0
        failed = 0
        skipped = 0

        for contact in page:
            processed += 1
            if dry_run:
                skipped += 1
                continue
            outcome, err_status = upsert_contact_to_mailchimp(
                contact=contact,
                tag_name=tag_name,
                merge_fields=None,
                logger=logger,
                session=session,
            )
            if outcome == "synced":
                succeeded += 1
            elif outcome == "failed":
                failed += 1
                if len(errors_sample) < 5:
                    errors_sample.append(
                        {
                            "contact_id": str(contact.id),
                            "reason": "mailchimp_api_error",
                            "status": err_status,
                            "lead_email_masked": mask_email(contact.email or ""),
                        }
                    )
            else:
                skipped += 1

        if dry_run:
            session.rollback()
        else:
            session.commit()

    would_process = processed if dry_run else 0
    logger.info(
        "Mailchimp sync batch complete",
        extra={
            "actor_sub": actor_sub,
            "request_id": request_id(event),
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "skipped": skipped,
            "dry_run": dry_run,
        },
    )

    return json_response(
        200,
        {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "skipped": skipped,
            "next_cursor": next_cursor,
            "errors_sample": errors_sample,
            "dry_run": dry_run,
            "would_process": would_process,
        },
        event=event,
    )


def run_mailchimp_orphan_cleanup(
    event: Mapping[str, Any],
    *,
    actor_sub: str,
) -> dict[str, Any]:
    err = _require_production_mailchimp_or_409(event)
    if err is not None:
        return err

    body = parse_body(event)
    max_members = _parse_max_contacts(
        body.get("max_members"), field="max_members", default=200, cap=1000
    )
    mailchimp_offset = _parse_mailchimp_offset(body.get("mailchimp_offset"))
    mode_raw = body.get("mode", "archive")
    if not isinstance(mode_raw, str):
        raise ValidationError("mode must be a string", field="mode")
    mode = mode_raw.strip().lower()
    if mode not in ("archive", "permanent"):
        raise ValidationError("mode must be archive or permanent", field="mode")
    dry_run = bool(body.get("dry_run", True))

    members = list(
        iter_audience_members(
            page_size=max_members,
            start_offset=mailchimp_offset,
            single_page=True,
            fields=ITER_AUDIENCE_MEMBER_FIELDS,
        )
    )
    scanned = len(members)
    kept = 0
    removed = 0
    would_remove = 0
    failed = 0
    already_archived = 0
    removed_sample: list[dict[str, str]] = []

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ContactRepository(session)

        for member in members:
            raw_email = member.get("email_address")
            if not isinstance(raw_email, str) or not raw_email.strip():
                continue
            email = raw_email.strip().lower()
            mc_status = str(member.get("status") or "")
            if mode == "archive" and mc_status == "archived":
                already_archived += 1
                continue
            db_contact = repository.find_by_email(email)
            should_keep = (
                db_contact is not None
                and db_contact.archived_at is None
                and db_contact.mailchimp_status != MailchimpSyncStatus.UNSUBSCRIBED
            )
            if should_keep:
                kept += 1
                continue

            if dry_run:
                would_remove += 1
                if len(removed_sample) < 5:
                    removed_sample.append(
                        {"email": mask_email(email), "status": mc_status or "unknown"}
                    )
                continue

            outcome = remove_contact_from_mailchimp(
                email=email,
                mode="permanent" if mode == "permanent" else "archive",
                logger=logger,
            )
            if outcome == "removed":
                removed += 1
                if db_contact is not None:
                    db_contact.mailchimp_status = MailchimpSyncStatus.UNSUBSCRIBED
                    db_contact.mailchimp_subscriber_id = None
                if len(removed_sample) < 5:
                    removed_sample.append(
                        {"email": mask_email(email), "status": mc_status or "unknown"}
                    )
            elif outcome == "failed":
                failed += 1

        if dry_run:
            session.rollback()
        else:
            session.commit()

    if dry_run or mode == "archive":
        next_offset = (
            mailchimp_offset + scanned
            if scanned == max_members and scanned > 0
            else None
        )
    else:
        if removed > 0:
            next_offset = mailchimp_offset
        else:
            next_offset = mailchimp_offset + scanned if scanned == max_members else None

    logger.info(
        "Mailchimp orphan cleanup batch complete",
        extra={
            "actor_sub": actor_sub,
            "request_id": request_id(event),
            "scanned": scanned,
            "kept": kept,
            "removed": removed,
            "would_remove": would_remove,
            "already_archived": already_archived,
            "failed": failed,
            "dry_run": dry_run,
        },
    )

    return json_response(
        200,
        {
            "scanned": scanned,
            "kept": kept,
            "removed": removed,
            "failed": failed,
            "next_offset": next_offset,
            "removed_sample": removed_sample,
            "dry_run": dry_run,
            "already_archived": already_archived,
            "would_remove": would_remove,
        },
        event=event,
    )


def get_mailchimp_sync_summary(event: Mapping[str, Any]) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = ContactRepository(session)
        counts = repository.count_by_mailchimp_status()
        archived_with_mailchimp = repository.count_archived_with_mailchimp_record()

    counts_by_status = {status.value: counts[status] for status in MailchimpSyncStatus}
    return json_response(
        200,
        {
            "counts_by_status": counts_by_status,
            "archived_with_mailchimp_record": archived_with_mailchimp,
            "last_run_summary": None,
        },
        event=event,
    )
