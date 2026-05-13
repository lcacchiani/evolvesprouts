"""Shared helpers for bulk PDF expense import (async worker + API)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import Expense
from app.db.repositories import OrganizationRepository


def resolve_bulk_row_vendor_id(
    org_repo: OrganizationRepository,
    parsed: Mapping[str, Any],
    *,
    default_vendor_id: UUID,
) -> UUID:
    parsed_vendor_only = bulk_pick_text(parsed.get("vendor_name"), fallback=None)
    if parsed_vendor_only:
        matched = org_repo.try_resolve_active_vendor_by_parsed_name(parsed_vendor_only)
        if matched is not None:
            return matched.id
    return default_vendor_id


def apply_openrouter_normalized_to_expense(
    expense: Expense, parsed: Mapping[str, Any]
) -> None:
    expense.invoice_number = bulk_pick_text(
        parsed.get("invoice_number"), fallback=expense.invoice_number
    )
    expense.invoice_date = bulk_pick_date(
        parsed.get("invoice_date"), fallback=expense.invoice_date
    )
    expense.due_date = bulk_pick_date(parsed.get("due_date"), fallback=expense.due_date)
    expense.currency = bulk_pick_currency(
        parsed.get("currency"), fallback=expense.currency
    )
    expense.subtotal = bulk_pick_decimal(
        parsed.get("subtotal"), fallback=expense.subtotal
    )
    expense.tax = bulk_pick_decimal(parsed.get("tax"), fallback=expense.tax)
    expense.total = bulk_pick_decimal(parsed.get("total"), fallback=expense.total)
    line_items = parsed.get("line_items")
    if isinstance(line_items, list):
        expense.line_items = line_items
    expense.parse_confidence = bulk_pick_decimal(
        parsed.get("confidence"), fallback=expense.parse_confidence
    )
    expense.parser_raw = (
        parsed.get("raw") if isinstance(parsed.get("raw"), dict) else {"raw": parsed}
    )


def bulk_pick_text(value: Any, *, fallback: str | None) -> str | None:
    if value is None:
        return fallback
    normalized = str(value).strip()
    return normalized or fallback


def bulk_pick_date(value: Any, *, fallback: date | None) -> date | None:
    if value is None:
        return fallback
    normalized = str(value).strip()
    if not normalized:
        return fallback
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        return fallback


def bulk_pick_currency(value: Any, *, fallback: str | None) -> str | None:
    if value is None:
        return fallback
    normalized = str(value).strip().upper()
    if len(normalized) != 3:
        return fallback
    return normalized


def bulk_pick_decimal(value: Any, *, fallback: Decimal | None) -> Decimal | None:
    if value is None:
        return fallback
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except Exception:
        return fallback


def build_parser_asset_dict(session: Session, attachment_id: UUID) -> dict[str, Any]:
    """Load asset fields required by OpenRouter bulk parser."""
    from app.db.repositories import AssetRepository

    assets = AssetRepository(session).list_by_ids([attachment_id])
    if not assets:
        raise ValueError("attachment_asset_id not found")
    asset_ent = assets[0]
    content_type = (asset_ent.content_type or "").strip().lower()
    file_name = (asset_ent.file_name or "").strip().lower()
    if "pdf" not in content_type and not file_name.endswith(".pdf"):
        raise ValueError("attachment_asset_id must reference a PDF document")
    return {
        "id": str(asset_ent.id),
        "s3_key": asset_ent.s3_key,
        "file_name": asset_ent.file_name,
        "content_type": asset_ent.content_type,
    }
