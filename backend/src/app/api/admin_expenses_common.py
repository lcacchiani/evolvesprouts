"""Shared parsing and serialization helpers for admin expenses."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any
from collections.abc import Mapping, Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import parse_uuid
from app.db.models import Expense, ExpenseParseStatus, ExpenseStatus
from app.db.repositories import AssetRepository
from app.exceptions import ValidationError

_STATUS_TERMINAL = {
    ExpenseStatus.PAID,
    ExpenseStatus.VOIDED,
    ExpenseStatus.AMENDED,
}


def serialize_expense(expense: Expense) -> dict[str, Any]:
    """Serialize expense model for API responses."""
    attachments = sorted(expense.attachments, key=lambda item: item.sort_order)
    return {
        "id": str(expense.id),
        "amends_expense_id": str(expense.amends_expense_id)
        if expense.amends_expense_id
        else None,
        "status": expense.status.value,
        "parse_status": expense.parse_status.value,
        "vendor_name": expense.vendor_name,
        "invoice_number": expense.invoice_number,
        "invoice_date": expense.invoice_date.isoformat()
        if expense.invoice_date is not None
        else None,
        "due_date": expense.due_date.isoformat()
        if expense.due_date is not None
        else None,
        "currency": expense.currency,
        "subtotal": decimal_to_string(expense.subtotal),
        "tax": decimal_to_string(expense.tax),
        "total": decimal_to_string(expense.total),
        "line_items": expense.line_items or [],
        "parse_confidence": decimal_to_string(expense.parse_confidence),
        "parser_raw": expense.parser_raw,
        "notes": expense.notes,
        "void_reason": expense.void_reason,
        "submitted_at": expense.submitted_at.isoformat()
        if expense.submitted_at is not None
        else None,
        "paid_at": expense.paid_at.isoformat() if expense.paid_at is not None else None,
        "voided_at": expense.voided_at.isoformat()
        if expense.voided_at is not None
        else None,
        "created_by": expense.created_by,
        "updated_by": expense.updated_by,
        "created_at": expense.created_at.isoformat(),
        "updated_at": expense.updated_at.isoformat(),
        "attachments": [
            {
                "id": str(attachment.id),
                "asset_id": str(attachment.asset_id),
                "sort_order": attachment.sort_order,
                "file_name": attachment.asset.file_name if attachment.asset else None,
                "content_type": attachment.asset.content_type
                if attachment.asset
                else None,
                "asset_title": attachment.asset.title if attachment.asset else None,
            }
            for attachment in attachments
        ],
    }


def resolve_asset_ids(session: Session, asset_ids: Sequence[UUID]) -> list[UUID]:
    """Validate asset IDs and return de-duplicated list preserving order."""
    unique_ids: list[UUID] = []
    seen: set[UUID] = set()
    for asset_id in asset_ids:
        if asset_id in seen:
            continue
        seen.add(asset_id)
        unique_ids.append(asset_id)
    assets = AssetRepository(session).list_by_ids(unique_ids)
    found_ids = {asset.id for asset in assets}
    missing_ids = [asset_id for asset_id in unique_ids if asset_id not in found_ids]
    if missing_ids:
        raise ValidationError(
            "One or more attachment assets do not exist",
            field="attachment_asset_ids",
        )
    return unique_ids


def parse_create_payload(body: dict[str, Any]) -> dict[str, Any]:
    """Parse create payload."""
    payload = parse_update_payload(body, allow_empty=False)
    payload["status"] = (
        parse_optional_status(optional_field(body, "status")) or ExpenseStatus.SUBMITTED
    )
    payload["parse_requested"] = parse_bool(
        optional_field(body, "parse_requested", "parseRequested"),
        default=True,
    )
    return payload


def parse_update_payload(
    body: dict[str, Any],
    *,
    allow_empty: bool = True,
) -> dict[str, Any]:
    """Parse update/amend payload."""
    payload: dict[str, Any] = {
        "status": parse_optional_status(optional_field(body, "status")),
        "vendor_name": parse_optional_string(
            optional_field(body, "vendor_name", "vendorName"),
            max_length=255,
        ),
        "invoice_number": parse_optional_string(
            optional_field(body, "invoice_number", "invoiceNumber"),
            max_length=128,
        ),
        "invoice_date": parse_optional_date(
            optional_field(body, "invoice_date", "invoiceDate")
        ),
        "due_date": parse_optional_date(optional_field(body, "due_date", "dueDate")),
        "currency": parse_optional_currency(optional_field(body, "currency")),
        "subtotal": parse_optional_decimal(optional_field(body, "subtotal")),
        "tax": parse_optional_decimal(optional_field(body, "tax")),
        "total": parse_optional_decimal(optional_field(body, "total")),
        "line_items": parse_optional_line_items(
            optional_field(body, "line_items", "lineItems")
        ),
        "notes": parse_optional_string(optional_field(body, "notes"), max_length=5000),
        "attachment_asset_ids": parse_optional_uuid_list(
            optional_field(body, "attachment_asset_ids", "attachmentAssetIds")
        ),
        "parse_requested": parse_bool(
            optional_field(body, "parse_requested", "parseRequested"),
            default=False,
        ),
    }
    if allow_empty:
        return payload
    if not payload["attachment_asset_ids"]:
        raise ValidationError(
            "attachment_asset_ids is required",
            field="attachment_asset_ids",
        )
    return payload


def apply_common_fields(expense: Expense, payload: Mapping[str, Any]) -> None:
    """Apply provided common fields on an expense entity (PATCH-safe)."""
    _FIELDS = (
        "vendor_name",
        "invoice_number",
        "invoice_date",
        "due_date",
        "currency",
        "subtotal",
        "tax",
        "total",
        "line_items",
        "notes",
    )
    for field in _FIELDS:
        value = payload.get(field)
        if value is not None:
            setattr(expense, field, value)


def optional_field(body: Mapping[str, Any], *keys: str) -> Any:
    """Return the first matching key from payload body."""
    for key in keys:
        if key in body:
            return body[key]
    return None


def required_string(body: Mapping[str, Any], key: str, *, max_length: int) -> str:
    """Parse required string field from body."""
    value = parse_optional_string(body.get(key), max_length=max_length)
    if not value:
        raise ValidationError(f"{key} is required", field=key)
    return value


def parse_optional_string(value: Any, *, max_length: int) -> str | None:
    """Parse optional bounded string value."""
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ValidationError(
            f"value exceeds max length {max_length}",
            field="value",
        )
    return normalized


def parse_optional_status(value: Any) -> ExpenseStatus | None:
    """Parse optional expense status."""
    normalized = parse_optional_string(value, max_length=32)
    if normalized is None:
        return None
    try:
        return ExpenseStatus(normalized.lower())
    except ValueError as exc:
        raise ValidationError("Invalid expense status", field="status") from exc


def parse_optional_parse_status(value: Any) -> ExpenseParseStatus | None:
    """Parse optional parse status."""
    normalized = parse_optional_string(value, max_length=32)
    if normalized is None:
        return None
    try:
        return ExpenseParseStatus(normalized.lower())
    except ValueError as exc:
        raise ValidationError(
            "Invalid expense parse status", field="parse_status"
        ) from exc


def parse_optional_decimal(value: Any) -> Decimal | None:
    """Parse optional decimal with two-decimal precision."""
    if value is None:
        return None
    text_value = str(value).strip()
    if not text_value:
        return None
    try:
        return Decimal(text_value).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError("Invalid decimal value", field="amount") from exc


def parse_optional_date(value: Any) -> date | None:
    """Parse optional ISO date."""
    normalized = parse_optional_string(value, max_length=20)
    if normalized is None:
        return None
    try:
        return date.fromisoformat(normalized)
    except ValueError as exc:
        raise ValidationError("Date must use YYYY-MM-DD", field="date") from exc


def parse_optional_currency(value: Any) -> str | None:
    """Parse optional ISO currency code."""
    normalized = parse_optional_string(value, max_length=3)
    if normalized is None:
        return None
    upper_value = normalized.upper()
    if len(upper_value) != 3:
        raise ValidationError("currency must be a 3-letter code", field="currency")
    return upper_value


def parse_optional_line_items(value: Any) -> list[dict[str, object]] | None:
    """Parse optional line-item list."""
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValidationError("line_items must be an array", field="line_items")
    parsed: list[dict[str, object]] = []
    for index, item in enumerate(value):
        if not isinstance(item, Mapping):
            raise ValidationError(
                f"line_items[{index}] must be an object",
                field="line_items",
            )
        parsed.append(
            {
                "description": parse_optional_string(
                    optional_field(item, "description"),
                    max_length=500,
                ),
                "quantity": decimal_to_string(
                    parse_optional_decimal(optional_field(item, "quantity"))
                ),
                "unit_price": decimal_to_string(
                    parse_optional_decimal(
                        optional_field(item, "unit_price", "unitPrice")
                    )
                ),
                "amount": decimal_to_string(
                    parse_optional_decimal(optional_field(item, "amount"))
                ),
            }
        )
    return parsed


def parse_optional_uuid_list(value: Any) -> list[UUID] | None:
    """Parse optional UUID list."""
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValidationError(
            "attachment_asset_ids must be an array",
            field="attachment_asset_ids",
        )
    parsed: list[UUID] = []
    for entry in value:
        try:
            parsed.append(parse_uuid(str(entry)))
        except ValidationError as exc:
            raise ValidationError(
                "attachment_asset_ids must contain valid UUIDs",
                field="attachment_asset_ids",
            ) from exc
    return parsed


def parse_bool(value: Any, *, default: bool) -> bool:
    """Parse optional boolean values from bool/string literals."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
    raise ValidationError("Expected boolean value", field="boolean")


def decimal_to_string(value: Decimal | None) -> str | None:
    """Serialize decimal values for JSON output."""
    if value is None:
        return None
    return format(value, "f")
