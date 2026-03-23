"""Tests for mark-paid prerequisites on admin expense invoices."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.api.admin_expenses_common import ensure_expense_ready_to_mark_paid
from app.exceptions import ValidationError


def _expense_mock(**kwargs: object) -> MagicMock:
    expense = MagicMock()
    expense.vendor_id = kwargs.get("vendor_id", UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))
    expense.invoice_date = kwargs.get("invoice_date", date(2026, 1, 15))
    expense.currency = kwargs.get("currency", "HKD")
    expense.total = kwargs.get("total", Decimal("10.00"))
    return expense


def test_ensure_expense_ready_to_mark_paid_allows_complete() -> None:
    ensure_expense_ready_to_mark_paid(_expense_mock())


def test_ensure_expense_ready_to_mark_paid_rejects_missing_vendor() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_expense_ready_to_mark_paid(_expense_mock(vendor_id=None))
    assert "vendor" in exc_info.value.message.lower()


def test_ensure_expense_ready_to_mark_paid_rejects_missing_invoice_date() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_expense_ready_to_mark_paid(_expense_mock(invoice_date=None))
    assert "invoice date" in exc_info.value.message.lower()


def test_ensure_expense_ready_to_mark_paid_rejects_missing_currency() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_expense_ready_to_mark_paid(_expense_mock(currency=None))
    assert "currency" in exc_info.value.message.lower()


def test_ensure_expense_ready_to_mark_paid_rejects_blank_currency() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_expense_ready_to_mark_paid(_expense_mock(currency="  "))
    assert "currency" in exc_info.value.message.lower()


def test_ensure_expense_ready_to_mark_paid_rejects_missing_total() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_expense_ready_to_mark_paid(_expense_mock(total=None))
    assert "total" in exc_info.value.message.lower()
