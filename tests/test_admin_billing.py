"""Tests for admin customer billing (AR) API and helpers."""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api import admin_billing
from app.db.models.enums import (
    BillingBillToKind,
    BillingInvoiceStatus,
    BillingPaymentDirection,
    BillingPaymentStatus,
)
from app.exceptions import ValidationError
from app.services import customer_billing


def test_handle_admin_billing_get_payment_and_unapplied_no_name_error(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: _get_payment / _unapplied must receive ``event`` for json_response."""
    pid = uuid4()

    class _FakePay:
        id = pid
        direction = MagicMock(value="inbound")
        status = MagicMock(value="succeeded")
        method = "stripe_card"
        amount = Decimal("10")
        currency = "HKD"
        original_payment_id = None
        stripe_payment_intent_id = "pi_test"
        stripe_refund_id = None
        enrollment_id = None
        contact_id = None
        succeeded_at = None
        created_at = MagicMock(isoformat=lambda: "2026-01-01T00:00:00+00:00")

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.return_value = _FakePay()
        yield s

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)
    monkeypatch.setattr(
        admin_billing, "payment_unapplied_amount", lambda _s, _pid: Decimal("3")
    )

    ev = api_gateway_event(
        method="GET",
        path=f"/v1/admin/billing/payments/{pid}",
        authorizer_context=admin_identity,
    )
    r1 = admin_billing.handle_admin_billing_request(
        ev, "GET", f"/v1/admin/billing/payments/{pid}"
    )
    assert r1["statusCode"] == 200
    body1 = json.loads(r1["body"])
    assert body1["unappliedAmount"] == "3"

    ev2 = api_gateway_event(
        method="GET",
        path=f"/v1/admin/billing/payments/{pid}/unapplied",
        authorizer_context=admin_identity,
    )
    r2 = admin_billing.handle_admin_billing_request(
        ev2, "GET", f"/v1/admin/billing/payments/{pid}/unapplied"
    )
    assert r2["statusCode"] == 200
    body2 = json.loads(r2["body"])
    assert body2["paymentId"] == str(pid)
    assert body2["unappliedAmount"] == "3"


def test_payment_unapplied_amount_subtracts_allocations() -> None:
    pid = uuid4()
    pay = MagicMock()
    pay.amount = Decimal("100")
    session = MagicMock()
    session.get.return_value = pay
    m = MagicMock()
    m.scalar_one.return_value = Decimal("35")
    session.execute.return_value = m
    assert customer_billing.payment_unapplied_amount(session, pid) == Decimal("65")


def test_next_invoice_number_increments_per_currency_year(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _CounterRow:
        last_number = 0

    row = _CounterRow()
    n_calls = {"n": 0}

    def _exec(*_a: Any, **_k: Any) -> MagicMock:
        n_calls["n"] += 1
        out = MagicMock()
        out.scalar_one.return_value = row
        return out

    session = MagicMock()
    session.execute.side_effect = _exec
    num, seq = customer_billing.next_invoice_number(session, currency="hkd")
    assert seq == 1
    assert row.last_number == 1
    assert num.startswith("INV-")
    assert num.endswith("-HKD")
    assert n_calls["n"] == 2


def test_create_invoice_draft_rejects_currency_mismatch(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    body = {
        "enrollmentIds": [str(eid)],
        "currency": "USD",
    }
    fake_en = MagicMock()
    fake_en.id = eid
    fake_en.currency = "HKD"
    fake_en.instance = None
    fake_en.contact = None
    fake_en.bill_to_kind = None
    fake_en.bill_to_contact_id = None
    fake_en.bill_to_family_id = None
    fake_en.bill_to_organization_id = None

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [fake_en]
            return out

        s.execute.side_effect = _exec
        yield s

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)

    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="currency"):
        admin_billing.handle_admin_billing_request(
            ev, "POST", "/v1/admin/billing/invoices"
        )


def test_create_invoice_draft_rejects_billto_mismatch(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    e1, e2 = uuid4(), uuid4()
    fam1, fam2 = uuid4(), uuid4()

    def _make_en(eid: Any, fam_id: Any) -> MagicMock:
        en = MagicMock()
        en.id = eid
        en.currency = "HKD"
        en.instance = MagicMock(title="T")
        en.contact = MagicMock(email="a@example.com", first_name="A", last_name="B")
        en.bill_to_kind = BillingBillToKind.FAMILY
        en.bill_to_contact_id = None
        en.bill_to_family_id = fam_id
        en.bill_to_organization_id = None
        return en

    en1 = _make_en(e1, fam1)
    en2 = _make_en(e2, fam2)

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [en1, en2]
            return out

        s.execute.side_effect = _exec
        yield s

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)

    body = {"enrollmentIds": [str(e1), str(e2)], "currency": "HKD"}
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="bill-to"):
        admin_billing.handle_admin_billing_request(
            ev, "POST", "/v1/admin/billing/invoices"
        )


def test_confirm_payment_creates_receipt_for_pending_inbound(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pid = uuid4()
    created = {"n": 0}

    class _Pending:
        id = pid
        direction = BillingPaymentDirection.INBOUND
        status = BillingPaymentStatus.PENDING
        method = "bank_transfer"
        amount = Decimal("50")
        currency = "HKD"
        original_payment_id = None
        stripe_payment_intent_id = None
        stripe_refund_id = None
        enrollment_id = None
        contact_id = None
        succeeded_at = None
        created_at = MagicMock(isoformat=lambda: "2026-01-01T00:00:00+00:00")

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is admin_billing.CustomerPayment and pk == pid:
                return _Pending()
            if model is admin_billing.CustomerReceipt:
                return None
            return None

        s.get.side_effect = _get
        ex = MagicMock()
        ex.scalar_one_or_none.return_value = None
        s.execute.return_value = ex
        yield s

    def _create_rcpt(_session: Any, *, payment: Any) -> MagicMock:
        created["n"] += 1
        return MagicMock()

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)
    monkeypatch.setattr(
        admin_billing,
        "create_receipt_for_succeeded_inbound_payment",
        _create_rcpt,
    )
    monkeypatch.setattr(
        admin_billing,
        "finalize_receipt_pdf_upload",
        lambda *_a, **_k: None,
    )

    ev = api_gateway_event(
        method="POST",
        path=f"/v1/admin/billing/payments/{pid}/confirm",
        body="{}",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "POST", f"/v1/admin/billing/payments/{pid}/confirm"
    )
    assert r["statusCode"] == 200
    assert created["n"] == 1


def test_refund_create_rejects_currency_mismatch_with_original(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    orig_id = uuid4()

    class _Orig:
        id = orig_id
        currency = "HKD"

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.return_value = _Orig()
        yield s

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)

    body = {
        "direction": "refund",
        "originalPaymentId": str(orig_id),
        "amount": "10",
        "currency": "USD",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="currency"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_list_invoices_returns_items_and_cursor(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()
    created = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)

    class _Inv:
        id = inv_id
        status = BillingInvoiceStatus.DRAFT
        invoice_number = None
        invoice_sequence = None
        currency = "HKD"
        subtotal = Decimal("100")
        tax_total = Decimal("0")
        total = Decimal("100")
        bill_to_kind = BillingBillToKind.CONTACT
        bill_to_contact_id = uuid4()
        bill_to_family_id = None
        bill_to_organization_id = None
        bill_to_display_name = "Test"
        bill_to_email = "t@example.com"
        issued_at = None
        voided_at = None
        void_reason = None
        issued_pdf_sha256 = None
        created_at = created
        updated_at = created

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(all=lambda: [_Inv()])),
            MagicMock(all=lambda: [(inv_id, 2)]),
        ]
        yield s

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/invoices",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == str(inv_id)
    assert body["items"][0]["lineCount"] == 2
    assert body["next_cursor"] is None


def test_get_invoice_returns_detail_with_lines(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()
    line_id = uuid4()
    en_id = uuid4()
    ts = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)

    class _Line:
        id = line_id
        invoice_id = inv_id
        enrollment_id = en_id
        line_order = 1
        description = "Course"
        quantity = Decimal("1")
        unit_amount = Decimal("100")
        line_total = Decimal("100")
        discount_amount = None
        tax_rate = None
        tax_amount = None
        currency = "HKD"
        created_at = ts
        updated_at = ts

    class _Inv:
        id = inv_id
        status = BillingInvoiceStatus.DRAFT
        invoice_number = None
        invoice_sequence = None
        currency = "HKD"
        subtotal = Decimal("100")
        tax_total = Decimal("0")
        total = Decimal("100")
        bill_to_kind = BillingBillToKind.CONTACT
        bill_to_contact_id = uuid4()
        bill_to_family_id = None
        bill_to_organization_id = None
        bill_to_display_name = "Test"
        bill_to_email = "t@example.com"
        issued_at = None
        voided_at = None
        void_reason = None
        bill_to_snapshot = {"kind": "contact"}
        issued_pdf_sha256 = None
        email_sent_at = None
        created_at = ts
        updated_at = ts
        lines = [_Line()]

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.execute.return_value.scalar_one_or_none.return_value = _Inv()
        yield s

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)

    ev = api_gateway_event(
        method="GET",
        path=f"/v1/admin/billing/invoices/{inv_id}",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "GET", f"/v1/admin/billing/invoices/{inv_id}"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["invoice"]["id"] == str(inv_id)
    assert len(body["invoice"]["lines"]) == 1
    assert body["invoice"]["lines"][0]["id"] == str(line_id)


def test_export_csv_rejects_invalid_export_version(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    monkeypatch.setattr(admin_billing, "_session_with_audit", _fake_session)

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/export",
        query_params={"exportVersion": "9"},
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="exportVersion"):
        admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/export")
