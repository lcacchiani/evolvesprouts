"""Execute bulk PDF expense import jobs (SQS worker).

Time budget: the bulk-import Lambda timeout is configured in CDK (typically **600s**)
via ``BULK_IMPORT_LAMBDA_TIMEOUT_SECONDS``. OpenRouter bulk parse is capped at
**240s** so the remainder covers asset validation, per-row expense commits, and
job status updates without racing the Lambda hard timeout.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_expenses_common import resolve_asset_ids, resolve_vendor
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import ExpenseParseStatus, ExpenseStatus
from app.db.models.bulk_expense_import_job import BulkExpenseImportJobStatus
from app.db.repositories import ExpenseRepository, OrganizationRepository
from app.db.repositories.bulk_expense_import_job import BulkExpenseImportJobRepository
from app.exceptions import ValidationError
from app.services.bulk_expense_import_common import (
    apply_openrouter_normalized_to_expense,
    build_parser_asset_dict,
    resolve_bulk_row_vendor_id,
)
from app.services.openrouter_expense_parser import (
    parse_bulk_expense_invoices_from_assets,
)
from app.utils.logging import get_logger, mask_pii

logger = get_logger(__name__)

_OPENROUTER_TIMEOUT_SECONDS = 240


def _lambda_timeout_seconds() -> int:
    raw = os.environ.get("BULK_IMPORT_LAMBDA_TIMEOUT_SECONDS", "600").strip()
    try:
        return max(60, int(raw))
    except ValueError:
        return 600


def _processing_stale_threshold() -> timedelta:
    """Treat PROCESSING rows older than this as abandoned (worker died)."""
    sec = _lambda_timeout_seconds() * 2 + 120
    return timedelta(seconds=sec)


def sanitize_bulk_import_error_message(message: str) -> str:
    """Redact persisted/API-facing bulk-import error text."""
    trimmed = (message or "").strip()
    if not trimmed:
        return "An error occurred."
    if len(trimmed) > 8000:
        trimmed = trimmed[:8000]
    return mask_pii(trimmed, visible_chars=4)


@dataclass(frozen=True)
class BulkImportWorkerOutcome:
    """Whether the SQS message should be deleted (``True``) or retried (``False``)."""

    ack_sqs_message: bool


def process_bulk_expense_import_job(job_id: UUID) -> BulkImportWorkerOutcome:
    """Load job, parse PDF via OpenRouter, create expenses, update job status."""
    req_id = f"bulk-import-job:{job_id}"
    stale_after = _processing_stale_threshold()

    with Session(get_engine()) as session:
        job_repo = BulkExpenseImportJobRepository(session)
        job = job_repo.get_by_id(job_id)
        if job is None:
            logger.warning("Bulk import job not found", extra={"job_id": str(job_id)})
            return BulkImportWorkerOutcome(ack_sqs_message=True)
        if job.status in (
            BulkExpenseImportJobStatus.SUCCEEDED,
            BulkExpenseImportJobStatus.SUCCEEDED_WITH_ERRORS,
        ):
            logger.info(
                "Bulk import job already finished; skipping",
                extra={"job_id": str(job_id), "status": job.status.value},
            )
            return BulkImportWorkerOutcome(ack_sqs_message=True)
        if job.status == BulkExpenseImportJobStatus.FAILED:
            logger.info(
                "Bulk import job already failed; skipping",
                extra={"job_id": str(job_id)},
            )
            return BulkImportWorkerOutcome(ack_sqs_message=True)

        if job.status == BulkExpenseImportJobStatus.PROCESSING:
            now = datetime.now(UTC)
            updated = job.updated_at
            if updated is not None and (now - updated) < stale_after:
                logger.info(
                    "Bulk import job still processing elsewhere; deferring SQS message",
                    extra={"job_id": str(job_id)},
                )
                return BulkImportWorkerOutcome(ack_sqs_message=False)
            set_audit_context(session, user_id=job.created_by, request_id=req_id)
            job_repo.mark_failed(
                job,
                sanitize_bulk_import_error_message(
                    "Worker did not finish the previous attempt; please retry the import."
                ),
            )
            session.commit()
            return BulkImportWorkerOutcome(ack_sqs_message=True)

        if job.status != BulkExpenseImportJobStatus.PENDING:
            logger.warning(
                "Bulk import job in unexpected state",
                extra={"job_id": str(job_id), "status": job.status.value},
            )
            return BulkImportWorkerOutcome(ack_sqs_message=True)

        actor_sub = job.created_by
        attachment_id = job.attachment_asset_id
        default_vendor_id = job.default_vendor_id
        expense_status = job.expense_status

        set_audit_context(session, user_id=actor_sub, request_id=req_id)
        job_repo.mark_processing(job)
        session.commit()

    try:
        with Session(get_engine()) as session:
            set_audit_context(session, user_id=actor_sub, request_id=req_id)
            resolve_vendor(session, default_vendor_id)
            parser_asset = build_parser_asset_dict(session, attachment_id)
    except ValidationError as exc:
        _fail_job(job_id, str(exc))
        return BulkImportWorkerOutcome(ack_sqs_message=True)
    except ValueError as exc:
        _fail_job(job_id, str(exc))
        return BulkImportWorkerOutcome(ack_sqs_message=True)
    except Exception as exc:
        logger.exception(
            "Bulk import job validation failed", extra={"job_id": str(job_id)}
        )
        _fail_job(job_id, repr(exc))
        return BulkImportWorkerOutcome(ack_sqs_message=True)

    try:
        normalized_rows = parse_bulk_expense_invoices_from_assets(
            [parser_asset], timeout=_OPENROUTER_TIMEOUT_SECONDS
        )
    except (RuntimeError, ValueError) as exc:
        _fail_job(job_id, repr(exc))
        return BulkImportWorkerOutcome(ack_sqs_message=True)
    except Exception as exc:
        logger.exception(
            "Bulk import OpenRouter parse failed", extra={"job_id": str(job_id)}
        )
        _fail_job(job_id, repr(exc))
        return BulkImportWorkerOutcome(ack_sqs_message=True)

    created_ids: list[UUID] = []
    row_errors: list[str] = []
    for row_index, parsed in enumerate(normalized_rows):
        try:
            with Session(get_engine()) as session:
                set_audit_context(session, user_id=actor_sub, request_id=req_id)
                expense_repo = ExpenseRepository(session)
                org_repo = OrganizationRepository(session)
                resolve_vendor(session, default_vendor_id)
                asset_ids = resolve_asset_ids(session, [attachment_id])
                now = datetime.now(UTC)
                vendor_id = resolve_bulk_row_vendor_id(
                    org_repo, parsed, default_vendor_id=default_vendor_id
                )
                expense = expense_repo.create_expense(
                    created_by=actor_sub,
                    status=expense_status,
                    parse_status=ExpenseParseStatus.SUCCEEDED,
                    vendor_id=vendor_id,
                    invoice_number=None,
                    invoice_date=None,
                    due_date=None,
                    currency=None,
                    subtotal=None,
                    tax=None,
                    total=None,
                    line_items=None,
                    notes=None,
                )
                apply_openrouter_normalized_to_expense(expense, parsed)
                expense.updated_by = actor_sub
                if expense_status == ExpenseStatus.SUBMITTED:
                    expense.submitted_at = now
                expense_repo.replace_attachments(expense, asset_ids)
                expense_repo.update(expense)
                session.commit()
                created_ids.append(expense.id)
        except Exception as exc:
            logger.exception(
                "Bulk import row failed",
                extra={"job_id": str(job_id), "row_index": row_index},
            )
            row_errors.append(
                f"row {row_index}: {sanitize_bulk_import_error_message(repr(exc))}"
            )

    if not created_ids and row_errors:
        summary = "; ".join(row_errors)[:7900]
        _fail_job(job_id, summary)
        return BulkImportWorkerOutcome(ack_sqs_message=True)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=req_id)
        job_repo = BulkExpenseImportJobRepository(session)
        refreshed = job_repo.get_by_id(job_id)
        if refreshed is None:
            return BulkImportWorkerOutcome(ack_sqs_message=True)
        if row_errors:
            summary = (
                f"Imported {len(created_ids)} of {len(normalized_rows)} rows. "
                + "; ".join(row_errors)
            )[:8000]
            job_repo.mark_succeeded_with_errors(
                refreshed,
                expense_ids=created_ids,
                created_count=len(created_ids),
                message=summary,
            )
        else:
            job_repo.mark_succeeded(
                refreshed, expense_ids=created_ids, created_count=len(created_ids)
            )
        session.commit()

    return BulkImportWorkerOutcome(ack_sqs_message=True)


def _fail_job(job_id: UUID, message: str) -> None:
    safe = sanitize_bulk_import_error_message(message)
    with Session(get_engine()) as session:
        job_repo = BulkExpenseImportJobRepository(session)
        job = job_repo.get_by_id(job_id)
        if job is None:
            return
        set_audit_context(
            session,
            user_id=job.created_by,
            request_id=f"bulk-import-job:{job_id}",
        )
        job_repo.mark_failed(job, safe)
        session.commit()
