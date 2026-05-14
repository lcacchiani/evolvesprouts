"""Tests for ``recompute_invoice_settlement``."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.db.models.enums import BillingInvoiceStatus
from app.services.customer_billing import recompute_invoice_settlement


def _mock_result(scalar_one_value):
    m = MagicMock()
    m.scalar_one.return_value = scalar_one_value
    return m


def test_recompute_zero_allocations_open_balance() -> None:
    inv_id = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.ISSUED,
        currency="HKD",
        total=Decimal("100.0000"),
        amount_allocated=Decimal("0"),
        balance_due=Decimal("0"),
        paid_at=None,
    )
    calls = {"n": 0}

    def _exec(_stmt, *_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _mock_result(inv)
        return _mock_result(Decimal("0"))

    session = MagicMock()
    session.execute.side_effect = _exec

    recompute_invoice_settlement(session, inv)

    assert inv.amount_allocated == Decimal("0")
    assert inv.balance_due == Decimal("100.0000")
    assert inv.paid_at is None


def test_recompute_partial_allocation_no_paid_at() -> None:
    inv_id = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.ISSUED,
        currency="HKD",
        total=Decimal("100"),
        amount_allocated=Decimal("0"),
        balance_due=Decimal("0"),
        paid_at=None,
    )
    calls = {"n": 0}

    def _exec(_stmt, *_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _mock_result(inv)
        return _mock_result(Decimal("40"))

    session = MagicMock()
    session.execute.side_effect = _exec

    recompute_invoice_settlement(session, inv)

    assert inv.amount_allocated == Decimal("40")
    assert inv.balance_due == Decimal("60")
    assert inv.paid_at is None


def test_recompute_full_allocation_sets_paid_at() -> None:
    inv_id = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.ISSUED,
        currency="HKD",
        total=Decimal("100"),
        amount_allocated=Decimal("0"),
        balance_due=Decimal("50"),
        paid_at=None,
    )
    calls = {"n": 0}

    def _exec(_stmt, *_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _mock_result(inv)
        return _mock_result(Decimal("100"))

    session = MagicMock()
    session.execute.side_effect = _exec

    before = datetime.now(UTC)
    recompute_invoice_settlement(session, inv)
    after = datetime.now(UTC)

    assert inv.amount_allocated == Decimal("100")
    assert inv.balance_due == Decimal("0")
    assert inv.paid_at is not None
    assert before <= inv.paid_at <= after


def test_recompute_over_allocation_clamps_balance_due() -> None:
    inv_id = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.ISSUED,
        currency="HKD",
        total=Decimal("100"),
        amount_allocated=Decimal("0"),
        balance_due=Decimal("0"),
        paid_at=None,
    )
    calls = {"n": 0}

    def _exec(_stmt, *_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _mock_result(inv)
        return _mock_result(Decimal("120"))

    session = MagicMock()
    session.execute.side_effect = _exec

    recompute_invoice_settlement(session, inv)

    assert inv.amount_allocated == Decimal("120")
    assert inv.balance_due == Decimal("0")
    assert inv.paid_at is not None


def test_recompute_void_clears_paid_at() -> None:
    inv_id = uuid4()
    ts = datetime(2026, 1, 1, tzinfo=UTC)
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.VOID,
        currency="HKD",
        total=Decimal("100"),
        amount_allocated=Decimal("100"),
        balance_due=Decimal("0"),
        paid_at=ts,
    )
    calls = {"n": 0}

    def _exec(_stmt, *_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _mock_result(inv)
        return _mock_result(Decimal("100"))

    session = MagicMock()
    session.execute.side_effect = _exec

    recompute_invoice_settlement(session, inv)

    assert inv.paid_at is None


def test_recompute_zero_total_issued_clears_paid_at() -> None:
    inv_id = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.ISSUED,
        currency="HKD",
        total=Decimal("0"),
        amount_allocated=Decimal("0"),
        balance_due=Decimal("0"),
        paid_at=None,
    )
    calls = {"n": 0}

    def _exec(_stmt, *_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _mock_result(inv)
        return _mock_result(Decimal("0"))

    session = MagicMock()
    session.execute.side_effect = _exec

    recompute_invoice_settlement(session, inv)

    assert inv.balance_due == Decimal("0")
    assert inv.paid_at is None
