"""Tests for admin customer billing (AR) API and helpers."""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app.api import admin_billing
from app.api import admin_billing_allocations as admin_billing_allocations_mod
from app.api import admin_billing_enrollment_queries as admin_billing_enrollment_queries_mod
from app.api import admin_billing_export as admin_billing_export_mod
from app.api import admin_billing_invoice_drafts as admin_billing_invoice_drafts_mod
from app.api import admin_billing_invoice_queries as admin_billing_invoice_queries_mod
from app.api import admin_billing_invoices as admin_billing_invoices_mod
from app.api import admin_billing_payments as admin_billing_payments_mod
from app.db.models import Enrollment
from app.db.models.customer_invoice import CustomerInvoice
from app.db.models.enums import (
    BillingBillToKind,
    BillingInvoiceStatus,
    BillingPaymentDirection,
    BillingPaymentStatus,
    EnrollmentStatus,
)
from app.exceptions import NotFoundError, ValidationError
from app.services import customer_billing


def _patch_billing_sessions(monkeypatch: pytest.MonkeyPatch, fake_session: Any) -> None:
    for mod in (
        admin_billing_payments_mod,
        admin_billing_invoice_queries_mod,
        admin_billing_invoices_mod,
        admin_billing_invoice_drafts_mod,
        admin_billing_allocations_mod,
        admin_billing_export_mod,
        admin_billing_enrollment_queries_mod,
    ):
        monkeypatch.setattr(mod, "_session_with_audit", fake_session)


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

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "_batch_orphan_payment_deletable",
        lambda _session, rows: {r.id: False for r in rows},
    )
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "payment_unapplied_amount",
        lambda _s, _pid: Decimal("3"),
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
    assert body1["orphanPaymentDeletable"] is False

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
        "draftKind": "enrollment_merge",
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

    _patch_billing_sessions(monkeypatch, _fake_session)

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

    _patch_billing_sessions(monkeypatch, _fake_session)

    body = {"draftKind": "enrollment_merge", "enrollmentIds": [str(e1), str(e2)], "currency": "HKD"}
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


def test_create_invoice_draft_derives_currency_when_omitted(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()

    fake_en = MagicMock()
    fake_en.id = eid
    fake_en.currency = "USD"
    fake_en.amount_paid = Decimal("10")
    fake_en.instance = MagicMock(title="Inst")
    fake_en.contact = MagicMock(
        email="u@example.com", first_name="U", last_name="Ser"
    )
    fake_en.bill_to_kind = BillingBillToKind.CONTACT
    fake_en.bill_to_contact_id = None
    fake_en.bill_to_family_id = None
    fake_en.bill_to_organization_id = None

    fake_inv = MagicMock()
    fake_inv.id = uuid4()
    fake_inv.status = MagicMock(value="draft")

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [fake_en]
            return out

        s.execute.side_effect = _exec
        s.get.side_effect = lambda model, pk: fake_inv if model is CustomerInvoice else None

        def _flush() -> None:
            pass

        s.flush = _flush
        return (yield s)

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "_resolve_bill_to_party_for_draft",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "AuditService",
        lambda *_a, **_k: MagicMock(log_custom=lambda **_kw: None),
    )

    body = {"draftKind": "enrollment_merge", "enrollmentIds": [str(eid)]}
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 201
    payload = json.loads(r["body"])
    assert payload["invoiceId"]


def test_create_invoice_draft_rejects_invalid_currency_length(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
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

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)

    body = {"draftKind": "enrollment_merge", "enrollmentIds": [str(eid)], "currency": "US"}
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


def test_list_recent_enrollments_orders_and_filters(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """blocked_eids scoped to candidates; cancel excluded; party email from primary."""

    iid = uuid4()
    earlier = datetime(2026, 1, 1, tzinfo=UTC)
    later = datetime(2026, 2, 1, tzinfo=UTC)
    fam_id = uuid4()

    inst = MagicMock()
    inst.title = "Spring Unit"
    inst.cohort = "A"

    tier = MagicMock()
    tier.name = "VIP"

    e_later = uuid4()
    e_earlier = uuid4()
    e_cancel = uuid4()

    en_later = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=fam_id,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_contact_id=None,
        bill_to_family_id=fam_id,
        bill_to_organization_id=None,
        status=EnrollmentStatus.CONFIRMED,
        amount_paid=Decimal("50.00"),
        currency="HKD",
        enrolled_at=later,
        cancelled_at=None,
        notes=None,
        created_by="test",
    )
    en_later.id = e_later
    en_later.instance = inst
    en_later.ticket_tier = tier
    en_later.contact = None
    en_later.family = MagicMock(family_name="Smith Family")
    en_later.organization = None
    en_later.bill_to_contact = None
    en_later.bill_to_family = MagicMock(family_name="Smith Family")
    en_later.bill_to_organization = None

    en_cancel = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=fam_id,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_contact_id=None,
        bill_to_family_id=fam_id,
        bill_to_organization_id=None,
        status=EnrollmentStatus.CANCELLED,
        amount_paid=Decimal("1"),
        currency="HKD",
        enrolled_at=later,
        cancelled_at=later,
        notes=None,
        created_by="test",
    )
    en_cancel.id = e_cancel

    en_earlier = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=fam_id,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_contact_id=None,
        bill_to_family_id=fam_id,
        bill_to_organization_id=None,
        status=EnrollmentStatus.CONFIRMED,
        amount_paid=Decimal("25"),
        currency="HKD",
        enrolled_at=earlier,
        cancelled_at=None,
        notes=None,
        created_by="test",
    )
    en_earlier.id = e_earlier
    en_earlier.instance = inst
    en_earlier.ticket_tier = None
    en_earlier.contact = None
    en_earlier.family = MagicMock(family_name="Smith Family")
    en_earlier.organization = None
    en_earlier.bill_to_contact = None
    en_earlier.bill_to_family = MagicMock(family_name="Smith Family")
    en_earlier.bill_to_organization = None

    exec_calls: list[Any] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(stmt: Any, *a: Any, **k: Any) -> MagicMock:
            exec_calls.append(stmt)
            out = MagicMock()
            sql = str(stmt)

            if "FROM enrollments" in sql or "enrollments." in sql:
                out.unique.return_value.scalars.return_value.all.return_value = [
                    en_later,
                    en_earlier,
                ]
            elif "customer_invoice_lines" in sql:
                out.scalars.return_value.all.return_value = [en_later.id]
            elif "FamilyMember" in sql or "family_members" in sql:
                out.all.return_value = [(fam_id, "primary@example.com")]
            elif "organization_members" in sql:
                out.all.return_value = []
            else:
                out.unique.return_value.scalars.return_value.all.return_value = []
                out.scalars.return_value.all.return_value = []
                out.all.return_value = []
            return out

        s.execute.side_effect = _exec
        yield s

    monkeypatch.setattr(
        admin_billing_enrollment_queries_mod, "_session_with_audit", _fake_session
    )

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/enrollments/recent-for-invoicing",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "GET", "/v1/admin/billing/enrollments/recent-for-invoicing"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["truncated"] is False
    ids = [x["enrollmentId"] for x in body["items"]]
    assert str(en_later.id) == ids[0]
    assert str(en_earlier.id) == ids[1]
    assert all(str(en_cancel.id) != x for x in ids)
    row0 = body["items"][0]
    assert row0["invoiceLinked"] is True
    assert row0["partyEmail"] == "primary@example.com"


def test_create_invoice_draft_currency_empty_string_derives(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()

    fake_en = MagicMock()
    fake_en.id = eid
    fake_en.currency = "HKD"
    fake_en.amount_paid = Decimal("10")
    fake_en.instance = MagicMock(title="Inst")
    fake_en.contact = MagicMock(
        email="u@example.com", first_name="U", last_name="Ser"
    )
    fake_en.bill_to_kind = BillingBillToKind.CONTACT
    fake_en.bill_to_contact_id = None
    fake_en.bill_to_family_id = None
    fake_en.bill_to_organization_id = None

    fake_inv = MagicMock()
    fake_inv.id = uuid4()
    fake_inv.status = MagicMock(value="draft")

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [fake_en]
            return out

        s.execute.side_effect = _exec
        s.get.side_effect = lambda model, pk: fake_inv if model is CustomerInvoice else None

        def _flush() -> None:
            pass

        s.flush = _flush
        return (yield s)

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "_resolve_bill_to_party_for_draft",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "AuditService",
        lambda *_a, **_k: MagicMock(log_custom=lambda **_kw: None),
    )

    body = {"draftKind": "enrollment_merge", "enrollmentIds": [str(eid)], "currency": ""}
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 201


def test_create_customized_invoice_draft_rejects_missing_currency(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(uuid4())},
        "lines": [{"description": "A", "quantity": "1", "unitAmount": "10"}],
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="currency"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_customized_invoice_draft_rejects_contact_not_found(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = uuid4()

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(_model: Any, _pk: Any) -> None:
            return None

        s.get.side_effect = _get
        yield s

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)

    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": [{"description": "A", "quantity": "1", "unitAmount": "10"}],
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="Contact not found"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_invoice_draft_rejects_enrollment_ids_with_bill_to(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    body = {
        "draftKind": "enrollment_merge",
        "enrollmentIds": [str(uuid4())],
        "billTo": {"kind": "contact", "contactId": str(uuid4())},
        "currency": "HKD",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="billTo must not"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_invoice_draft_requires_draft_kind(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    body = {"enrollmentIds": [str(uuid4())]}
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="draftKind"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_customized_invoice_draft_rejects_description_over_500(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = uuid4()
    fake_c = MagicMock()
    fake_c.first_name = "A"
    fake_c.last_name = "B"
    fake_c.email = "a@example.com"

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: fake_c if model.__name__ == "Contact" and pk == cid else None
        yield s

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)

    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": [{"description": "x" * 501, "quantity": "1", "unitAmount": "1"}],
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="500"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_customized_invoice_draft_rejects_both_tax_amount_and_rate(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = uuid4()
    fake_c = MagicMock()
    fake_c.first_name = "A"
    fake_c.last_name = "B"
    fake_c.email = "a@example.com"

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: fake_c if model.__name__ == "Contact" and pk == cid else None
        yield s

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)

    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": [
            {
                "description": "A",
                "quantity": "1",
                "unitAmount": "10",
                "taxRate": "0.1",
                "taxAmount": "1",
            }
        ],
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="not both"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_first_present_and_decimal_accepts_numeric_zero() -> None:
    from app.api.admin_billing_invoice_draft_helpers import _decimal_field, _first_present

    raw_ln: dict[str, Any] = {"unitAmount": 0}
    v = _first_present(raw_ln, "unitAmount", "unit_amount")
    assert _decimal_field(v, field="unitAmount") == Decimal("0")


def test_create_customized_invoice_draft_rejects_more_than_50_lines(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    cid = uuid4()
    lines = [{"description": "L", "quantity": "1", "unitAmount": "1"} for _ in range(51)]
    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": lines,
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="50"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_customized_invoice_draft_rejects_discount_exceeding_extended(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = uuid4()
    fake_c = MagicMock()
    fake_c.first_name = "A"
    fake_c.last_name = "B"
    fake_c.email = "a@example.com"

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: fake_c if model.__name__ == "Contact" and pk == cid else None
        yield s

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)

    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": [
            {
                "description": "A",
                "quantity": "1",
                "unitAmount": "10",
                "discountAmount": "11",
            }
        ],
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="discountAmount"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")


def test_create_customized_invoice_draft_tax_rate_rounds_half_up(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """0.1 * 0.0125 = 0.00125 -> 0.0013 with HALF_UP at 4dp; 0.0012 with HALF_EVEN."""
    from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP

    cid = uuid4()
    fake_c = MagicMock(email="c@example.com", first_name="A", last_name="B")
    fake_inv = MagicMock()
    fake_inv.id = uuid4()
    fake_inv.status = MagicMock(value="draft")
    line_kwargs: list[dict[str, Any]] = []

    def _make_line(**kwargs: Any) -> MagicMock:
        line_kwargs.append(kwargs)
        return MagicMock()

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if getattr(model, "__name__", "") == "Contact" and pk == cid:
                return fake_c
            if model is CustomerInvoice:
                return fake_inv
            return None

        s.get.side_effect = _get

        def _flush() -> None:
            pass

        s.flush = _flush
        yield s

    monkeypatch.setattr(admin_billing_invoice_drafts_mod, "_session_with_audit", _fake_session)
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "_resolve_bill_to_party_from_invoice_fks",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "AuditService",
        lambda *_a, **_k: MagicMock(log_custom=lambda **_kw: None),
    )
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "CustomerInvoiceLine",
        MagicMock(side_effect=_make_line),
    )

    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": [
            {
                "description": "Tax rounding",
                "quantity": "0.1",
                "unitAmount": "1",
                "taxRate": "0.0125",
            }
        ],
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 201
    assert len(line_kwargs) == 1
    tax_amt = line_kwargs[0]["tax_amount"]
    expected_half_up = (Decimal("0.1") * Decimal("0.0125")).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP
    )
    expected_half_even = (Decimal("0.1") * Decimal("0.0125")).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_EVEN
    )
    assert tax_amt == expected_half_up
    assert expected_half_up != expected_half_even


def test_list_recent_enrollments_void_invoice_does_not_block_linked_flag(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """invoiceLinked ignores lines whose parent invoice is void (status filter)."""

    iid = uuid4()
    ts = datetime(2026, 2, 1, tzinfo=UTC)
    eid = uuid4()

    en = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=None,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        bill_to_family_id=None,
        bill_to_organization_id=None,
        status=EnrollmentStatus.CONFIRMED,
        amount_paid=Decimal("10"),
        currency="HKD",
        enrolled_at=ts,
        cancelled_at=None,
        notes=None,
        created_by="test",
    )
    en.id = eid
    en.instance = MagicMock(title="T", cohort=None)
    en.ticket_tier = None
    en.contact = MagicMock(email="x@example.com", first_name="X", last_name="Y")
    en.family = None
    en.organization = None
    en.bill_to_contact = None
    en.bill_to_family = None
    en.bill_to_organization = None

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            sql = str(stmt)
            if "FROM enrollments" in sql or "enrollments." in sql:
                out.unique.return_value.scalars.return_value.all.return_value = [en]
            elif "customer_invoice_lines" in sql:
                out.scalars.return_value.all.return_value = []
            else:
                out.unique.return_value.scalars.return_value.all.return_value = []
                out.scalars.return_value.all.return_value = []
                out.all.return_value = []
            return out

        s.execute.side_effect = _exec
        yield s

    monkeypatch.setattr(
        admin_billing_enrollment_queries_mod, "_session_with_audit", _fake_session
    )

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/enrollments/recent-for-invoicing",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "GET", "/v1/admin/billing/enrollments/recent-for-invoicing"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert len(body["items"]) == 1
    assert body["items"][0]["invoiceLinked"] is False


def test_list_recent_enrollments_org_bill_to_primary_email(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    iid = uuid4()
    oid = uuid4()
    ts = datetime(2026, 2, 1, tzinfo=UTC)
    eid = uuid4()

    en = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=None,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.ORGANIZATION,
        bill_to_contact_id=None,
        bill_to_family_id=None,
        bill_to_organization_id=oid,
        status=EnrollmentStatus.CONFIRMED,
        amount_paid=Decimal("10"),
        currency="HKD",
        enrolled_at=ts,
        cancelled_at=None,
        notes=None,
        created_by="test",
    )
    en.id = eid
    en.instance = MagicMock(title="OrgInst", cohort=None)
    en.ticket_tier = None
    en.contact = None
    en.family = None
    en.organization = MagicMock(name="Acme Corp")
    en.bill_to_contact = None
    en.bill_to_family = None
    en.bill_to_organization = MagicMock(name="Acme Corp")

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            sql = str(stmt)
            if "FROM enrollments" in sql or "enrollments." in sql:
                out.unique.return_value.scalars.return_value.all.return_value = [en]
            elif "customer_invoice_lines" in sql:
                out.scalars.return_value.all.return_value = []
            elif "organization_members" in sql:
                out.all.return_value = [(oid, "org.primary@example.com")]
            elif "FamilyMember" in sql or "family_members" in sql:
                out.all.return_value = []
            else:
                out.unique.return_value.scalars.return_value.all.return_value = []
                out.scalars.return_value.all.return_value = []
                out.all.return_value = []
            return out

        s.execute.side_effect = _exec
        yield s

    monkeypatch.setattr(
        admin_billing_enrollment_queries_mod, "_session_with_audit", _fake_session
    )

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/enrollments/recent-for-invoicing",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "GET", "/v1/admin/billing/enrollments/recent-for-invoicing"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["items"][0]["partyEmail"] == "org.primary@example.com"


def test_list_recent_enrollments_parent_service_title_and_service_tier_fallback(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty instance title exposes parent service title; tier falls back to service.service_tier."""

    iid = uuid4()
    ts = datetime(2026, 2, 1, tzinfo=UTC)
    eid = uuid4()

    svc = MagicMock()
    svc.title = "Parent Course"
    svc.service_tier = "Standard"

    inst = MagicMock()
    inst.title = ""
    inst.cohort = "Cohort A"
    inst.service = svc

    en = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=None,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        bill_to_family_id=None,
        bill_to_organization_id=None,
        status=EnrollmentStatus.CONFIRMED,
        amount_paid=Decimal("10"),
        currency="HKD",
        enrolled_at=ts,
        cancelled_at=None,
        notes=None,
        created_by="test",
    )
    en.id = eid
    en.instance = inst
    en.ticket_tier = None
    en.contact = MagicMock(email="x@example.com", first_name="X", last_name="Y")
    en.family = None
    en.organization = None
    en.bill_to_contact = None
    en.bill_to_family = None
    en.bill_to_organization = None

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            sql = str(stmt)
            if "FROM enrollments" in sql or "enrollments." in sql:
                out.unique.return_value.scalars.return_value.all.return_value = [en]
            elif "customer_invoice_lines" in sql:
                out.scalars.return_value.all.return_value = []
            else:
                out.unique.return_value.scalars.return_value.all.return_value = []
                out.scalars.return_value.all.return_value = []
                out.all.return_value = []
            return out

        s.execute.side_effect = _exec
        yield s

    monkeypatch.setattr(
        admin_billing_enrollment_queries_mod, "_session_with_audit", _fake_session
    )

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/enrollments/recent-for-invoicing",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "GET", "/v1/admin/billing/enrollments/recent-for-invoicing"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    row = body["items"][0]
    assert row["instanceTitle"] is None
    assert row["parentServiceTitle"] == "Parent Course"
    assert row["serviceTierName"] == "Standard"
    assert row["instanceCohort"] == "Cohort A"


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
            if model is admin_billing_payments_mod.CustomerPayment and pk == pid:
                return _Pending()
            if model is admin_billing_payments_mod.CustomerReceipt:
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

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "_batch_orphan_payment_deletable",
        lambda _session, rows: {r.id: False for r in rows},
    )
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "create_receipt_for_succeeded_inbound_payment",
        _create_rcpt,
    )
    monkeypatch.setattr(
        admin_billing_payments_mod,
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


def test_delete_orphan_payment_succeeds(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pid = uuid4()
    pay = MagicMock()
    pay.id = pid
    pay.to_audit_dict.return_value = {"id": str(pid)}
    holder: dict[str, Any] = {}

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        holder["s"] = s

        def _get(model: Any, pk: Any) -> Any:
            if model is admin_billing_payments_mod.CustomerPayment and pk == pid:
                return pay
            return None

        s.get.side_effect = _get
        yield s

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **_kw: Any) -> None:
            return None

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod, "_validate_orphan_delete", lambda *_a, **_k: None
    )
    monkeypatch.setattr(admin_billing_payments_mod, "AuditService", _FakeAudit)

    ev = api_gateway_event(
        method="DELETE",
        path=f"/v1/admin/billing/payments/{pid}",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "DELETE", f"/v1/admin/billing/payments/{pid}"
    )
    assert r["statusCode"] == 204
    assert json.loads(r["body"]) == {}
    holder["s"].delete.assert_called_once_with(pay)


def test_delete_orphan_payment_not_found_raises(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pid = uuid4()

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.return_value = None
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="DELETE",
        path=f"/v1/admin/billing/payments/{pid}",
        authorizer_context=admin_identity,
    )
    with pytest.raises(NotFoundError):
        admin_billing.handle_admin_billing_request(
            ev, "DELETE", f"/v1/admin/billing/payments/{pid}"
        )


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

    _patch_billing_sessions(monkeypatch, _fake_session)

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

    _patch_billing_sessions(monkeypatch, _fake_session)

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

    _patch_billing_sessions(monkeypatch, _fake_session)

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


def test_get_invoice_pdf_returns_signed_url(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()

    class _Inv:
        id = inv_id
        status = BillingInvoiceStatus.DRAFT
        lines = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.execute.return_value.scalar_one_or_none.return_value = _Inv()
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    monkeypatch.setattr(
        admin_billing_invoice_queries_mod,
        "ensure_invoice_pdf_storage",
        lambda _session, _inv: "billing/invoices/preview/x.pdf",
    )

    def _fake_download(*, s3_key: str, cache_bust_key: str | None = None) -> dict[str, str]:
        assert s3_key == "billing/invoices/preview/x.pdf"
        assert cache_bust_key is not None and cache_bust_key.isdigit()
        return {
            "download_url": "https://cdn.example.com/signed",
            "expires_at": "2026-12-31T00:00:00+00:00",
        }

    monkeypatch.setattr(
        admin_billing_invoice_queries_mod,
        "generate_download_url",
        _fake_download,
    )

    ev = api_gateway_event(
        method="GET",
        path=f"/v1/admin/billing/invoices/{inv_id}/pdf",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "GET", f"/v1/admin/billing/invoices/{inv_id}/pdf"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["downloadUrl"] == "https://cdn.example.com/signed"
    assert body["expiresAt"] == "2026-12-31T00:00:00+00:00"


def test_export_csv_rejects_invalid_export_version(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/export",
        query_params={"exportVersion": "9"},
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="exportVersion"):
        admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/export")


def test_list_invoices_rejects_invalid_currency_length(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/invoices",
        query_params={"currency": "HK"},
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="currency"):
        admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")


def test_list_invoices_returns_next_cursor_when_has_more(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv1, inv2 = uuid4(), uuid4()
    created = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)

    def _make_inv(iid: UUID) -> MagicMock:
        inv = MagicMock()
        inv.id = iid
        inv.status = BillingInvoiceStatus.DRAFT
        inv.invoice_number = None
        inv.invoice_sequence = None
        inv.currency = "HKD"
        inv.subtotal = Decimal("1")
        inv.tax_total = Decimal("0")
        inv.total = Decimal("1")
        inv.bill_to_kind = BillingBillToKind.CONTACT
        inv.bill_to_contact_id = None
        inv.bill_to_family_id = None
        inv.bill_to_organization_id = None
        inv.bill_to_display_name = None
        inv.bill_to_email = None
        inv.issued_at = None
        inv.voided_at = None
        inv.void_reason = None
        inv.issued_pdf_sha256 = None
        inv.created_at = created
        inv.updated_at = created
        return inv

    row1, row2 = _make_inv(inv1), _make_inv(inv2)

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(all=lambda: [row1, row2])),
            MagicMock(all=lambda: []),
        ]
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/invoices",
        query_params={"limit": "1"},
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert len(body["items"]) == 1
    assert body["next_cursor"] is not None


def test_list_invoices_filters_by_currency_and_status(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[Any] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(stmt: Any, *a: Any, **k: Any) -> MagicMock:
            captured.append(stmt)
            out = MagicMock()
            out.scalars.return_value.all.return_value = []
            out.all.return_value = []
            return out

        s.execute.side_effect = _exec
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="GET",
        path="/v1/admin/billing/invoices",
        query_params={"currency": "HKD", "status": "draft"},
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 200
    assert captured
    stmt_text = str(captured[0]).lower()
    assert "customer_invoices.currency" in stmt_text
    assert "customer_invoices.status" in stmt_text


def test_email_invoice_accepts_comma_separated_recipients(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()
    captured: dict[str, Any] = {}

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    def _fake_send_invoice_email(
        _session: Any, *, invoice_id: UUID, to_addresses: list[str]
    ) -> None:
        captured["invoice_id"] = invoice_id
        captured["to_addresses"] = to_addresses

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        "app.api.admin_billing_invoices.send_invoice_email",
        _fake_send_invoice_email,
    )

    ev = api_gateway_event(
        method="POST",
        path=f"/v1/admin/billing/invoices/{inv_id}/email",
        body=json.dumps({"toEmail": " a@example.com ; b@example.com "}),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "POST", f"/v1/admin/billing/invoices/{inv_id}/email"
    )
    assert r["statusCode"] == 200
    assert captured["invoice_id"] == inv_id
    assert captured["to_addresses"] == ["a@example.com", "b@example.com"]


def test_email_invoice_rejects_invalid_email(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="POST",
        path=f"/v1/admin/billing/invoices/{inv_id}/email",
        body=json.dumps({"toEmail": "not-an-email"}),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="toEmail"):
        admin_billing.handle_admin_billing_request(
            ev, "POST", f"/v1/admin/billing/invoices/{inv_id}/email"
        )


def test_create_payment_returns_400_on_invalid_amount(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    orig_id = uuid4()

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)

    body = {
        "direction": "refund",
        "originalPaymentId": str(orig_id),
        "amount": "not-a-number",
        "currency": "HKD",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="amount"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")
