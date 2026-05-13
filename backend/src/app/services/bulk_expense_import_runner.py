"""Execute bulk PDF expense import jobs (SQS worker)."""

from __future__ import annotations

from datetime import UTC, datetime
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
from app.services.openrouter_expense_parser import parse_bulk_expense_invoices_from_assets
from app.utils.logging import get_logger

logger = get_logger(__name__)

_OPENROUTER_TIMEOUT_SECONDS = 280


def process_bulk_expense_import_job(job_id: UUID) -> None:
    """Load job, parse PDF via OpenRouter, create expenses, update job status."""
    with Session(get_engine()) as session:
        job_repo = BulkExpenseImportJobRepository(session)
        job = job_repo.get_by_id(job_id)
        if job is None:
            logger.warning("Bulk import job not found", extra={"job_id": str(job_id)})
            return
        if job.status == BulkExpenseImportJobStatus.SUCCEEDED:
            logger.info(
                "Bulk import job already succeeded; skipping",
                extra={"job_id": str(job_id)},
            )
            return
        if job.status == BulkExpenseImportJobStatus.FAILED:
            logger.info(
                "Bulk import job already failed; skipping",
                extra={"job_id": str(job_id)},
            )
            return
        if job.status != BulkExpenseImportJobStatus.PENDING:
            logger.warning(
                "Bulk import job in unexpected state",
                extra={"job_id": str(job_id), "status": job.status.value},
            )
            return

        actor_sub = job.created_by
        attachment_id = job.attachment_asset_id
        default_vendor_id = job.default_vendor_id
        expense_status = job.expense_status

        job_repo.mark_processing(job)
        session.commit()

    req_id = f"bulk-import-job:{job_id}"

    try:
        with Session(get_engine()) as session:
            set_audit_context(session, user_id=actor_sub, request_id=req_id)
            resolve_vendor(session, default_vendor_id)
            parser_asset = build_parser_asset_dict(session, attachment_id)
    except ValidationError as exc:
        _fail_job(job_id, str(exc))
        return
    except ValueError as exc:
        _fail_job(job_id, str(exc))
        return
    except Exception:
        logger.exception("Bulk import job validation failed", extra={"job_id": str(job_id)})
        _fail_job(job_id, "Failed to validate attachment for bulk import.")
        return

    try:
        normalized_rows = parse_bulk_expense_invoices_from_assets(
            [parser_asset], timeout=_OPENROUTER_TIMEOUT_SECONDS
        )
    except (RuntimeError, ValueError) as exc:
        _fail_job(job_id, str(exc))
        return
    except Exception:
        logger.exception("Bulk import OpenRouter parse failed", extra={"job_id": str(job_id)})
        _fail_job(job_id, "OpenRouter bulk parse failed.")
        return

    created_ids: list[UUID] = []
    try:
        with Session(get_engine()) as session:
            set_audit_context(session, user_id=actor_sub, request_id=req_id)
            expense_repo = ExpenseRepository(session)
            org_repo = OrganizationRepository(session)

            resolve_vendor(session, default_vendor_id)
            asset_ids = resolve_asset_ids(session, [attachment_id])
            now = datetime.now(UTC)

            for parsed in normalized_rows:
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
                created_ids.append(expense.id)

            session.commit()
    except Exception:
        logger.exception("Bulk import expense creation failed", extra={"job_id": str(job_id)})
        _fail_job(job_id, "Failed to create expenses from parsed rows.")
        return

    with Session(get_engine()) as session:
        job_repo = BulkExpenseImportJobRepository(session)
        refreshed = job_repo.get_by_id(job_id)
        if refreshed is None:
            return
        job_repo.mark_succeeded(
            refreshed, expense_ids=created_ids, created_count=len(created_ids)
        )
        session.commit()


def _fail_job(job_id: UUID, message: str) -> None:
    with Session(get_engine()) as session:
        job_repo = BulkExpenseImportJobRepository(session)
        job = job_repo.get_by_id(job_id)
        if job is None:
            return
        job_repo.mark_failed(job, message)
        session.commit()
