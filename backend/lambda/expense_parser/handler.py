"""Lambda handler for async expense parsing jobs."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import ExpenseParseStatus
from app.db.repositories import ExpenseRepository, OrganizationRepository
from app.events.sqs_batch import SqsBatchProcessor
from app.events.sqs_sns import parse_sqs_sns_message
from app.services.openrouter_expense_parser import parse_invoice_from_assets
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

_EVENT_TYPE_PARSE_REQUESTED = "expense.parse_requested"
_SYSTEM_ACTOR = "system"


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process expense parser messages from SQS."""
    batch = SqsBatchProcessor(logger=logger)

    for record in event.get("Records", []):
        with batch.record(
            record,
            failure_message="Failed to process expense parser message",
        ):
            message = parse_sqs_sns_message(record)
            if message.get("event_type") != _EVENT_TYPE_PARSE_REQUESTED:
                batch.skip()
                continue
            expense_id = str(message.get("expense_id") or "").strip()
            if not expense_id:
                batch.skip()
                continue
            _process_expense(expense_id)
            batch.process()

    return batch.response()


def _process_expense(expense_id: str) -> None:
    with Session(get_engine()) as session:
        repository = ExpenseRepository(session)
        expense = repository.get_with_attachments(_to_uuid(expense_id))
        if expense is None:
            logger.warning(
                "Skipping parse for missing expense", extra={"expense_id": expense_id}
            )
            return
        if not expense.attachments:
            expense.parse_status = ExpenseParseStatus.FAILED
            expense.parser_raw = {"error": "Expense has no attachments"}
            expense.updated_by = _SYSTEM_ACTOR
            repository.update(expense)
            session.commit()
            return

        parser_assets = [
            {
                "id": str(attachment.asset_id),
                "s3_key": attachment.asset.s3_key,
                "file_name": attachment.asset.file_name,
                "content_type": attachment.asset.content_type,
            }
            for attachment in expense.attachments
            if attachment.asset is not None
        ]
        if not parser_assets:
            expense.parse_status = ExpenseParseStatus.FAILED
            expense.parser_raw = {"error": "Expense attachments missing asset metadata"}
            expense.updated_by = _SYSTEM_ACTOR
            repository.update(expense)
            session.commit()
            return

        expense.parse_status = ExpenseParseStatus.PROCESSING
        expense.updated_by = _SYSTEM_ACTOR
        repository.update(expense)
        session.commit()

    try:
        parsed = parse_invoice_from_assets(parser_assets)
    except Exception as exc:
        logger.exception("Expense parsing failed", extra={"expense_id": expense_id})
        with Session(get_engine()) as session:
            repository = ExpenseRepository(session)
            failed_expense = repository.get_with_attachments(_to_uuid(expense_id))
            if failed_expense is None:
                return
            failed_expense.parse_status = ExpenseParseStatus.FAILED
            failed_expense.parser_raw = {"error": str(exc)}
            failed_expense.updated_by = _SYSTEM_ACTOR
            repository.update(failed_expense)
            session.commit()
        return

    with Session(get_engine()) as session:
        repository = ExpenseRepository(session)
        refreshed_expense = repository.get_with_attachments(_to_uuid(expense_id))
        if refreshed_expense is None:
            return
        if refreshed_expense.vendor_id is None:
            parsed_vendor_only = _pick_text(parsed.get("vendor_name"), fallback=None)
            if parsed_vendor_only:
                matched_vendor = OrganizationRepository(
                    session
                ).try_resolve_active_vendor_by_parsed_name(parsed_vendor_only)
                if matched_vendor is not None:
                    refreshed_expense.vendor_id = matched_vendor.id
        refreshed_expense.invoice_number = _pick_text(
            parsed.get("invoice_number"), fallback=refreshed_expense.invoice_number
        )
        refreshed_expense.invoice_date = _pick_date(
            parsed.get("invoice_date"), fallback=refreshed_expense.invoice_date
        )
        refreshed_expense.due_date = _pick_date(
            parsed.get("due_date"), fallback=refreshed_expense.due_date
        )
        refreshed_expense.currency = _pick_currency(
            parsed.get("currency"), fallback=refreshed_expense.currency
        )
        refreshed_expense.subtotal = _pick_decimal(
            parsed.get("subtotal"), fallback=refreshed_expense.subtotal
        )
        refreshed_expense.tax = _pick_decimal(
            parsed.get("tax"), fallback=refreshed_expense.tax
        )
        refreshed_expense.total = _pick_decimal(
            parsed.get("total"), fallback=refreshed_expense.total
        )
        line_items = parsed.get("line_items")
        if isinstance(line_items, list):
            refreshed_expense.line_items = line_items
        refreshed_expense.parse_confidence = _pick_decimal(
            parsed.get("confidence"), fallback=refreshed_expense.parse_confidence
        )
        refreshed_expense.parser_raw = (
            parsed.get("raw")
            if isinstance(parsed.get("raw"), dict)
            else {"raw": parsed}
        )
        refreshed_expense.parse_status = ExpenseParseStatus.SUCCEEDED
        refreshed_expense.updated_by = _SYSTEM_ACTOR
        refreshed_expense.updated_at = datetime.now(UTC)
        repository.update(refreshed_expense)
        session.commit()


def _to_uuid(value: str):
    from uuid import UUID

    return UUID(value)


def _pick_text(value: Any, *, fallback: str | None) -> str | None:
    if value is None:
        return fallback
    normalized = str(value).strip()
    return normalized or fallback


def _pick_date(value: Any, *, fallback: Any):
    if value is None:
        return fallback
    from datetime import date

    normalized = str(value).strip()
    if not normalized:
        return fallback
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        return fallback


def _pick_currency(value: Any, *, fallback: str | None) -> str | None:
    if value is None:
        return fallback
    normalized = str(value).strip().upper()
    if len(normalized) != 3:
        return fallback
    return normalized


def _pick_decimal(value: Any, *, fallback: Decimal | None) -> Decimal | None:
    if value is None:
        return fallback
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except Exception:
        return fallback
