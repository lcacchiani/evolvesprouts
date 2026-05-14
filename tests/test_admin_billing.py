"""Tests for admin customer billing (AR) API and helpers."""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from types import SimpleNamespace
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
from app.api import admin_billing_payment_create as admin_billing_payment_create_mod
from app.api import admin_billing_payments as admin_billing_payments_mod
from app.api.admin_billing_common import (
    effective_enrollment_bill_to_fks,
    enrollment_bill_to_merge_key,
)
from app.api.admin_billing_invoice_serializers import parse_optional_invoice_settlement
from app.db.models import Contact, Enrollment
from app.db.models.customer_invoice import CustomerInvoice
from app.db.models.customer_payment import CustomerPayment
from app.db.models.enums import (
    BillingBillToKind,
    BillingInvoiceStatus,
    BillingPaymentDirection,
    BillingPaymentStatus,
    EnrollmentStatus,
    ServiceType,
)
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.services import customer_billing


def _patch_billing_sessions(monkeypatch: pytest.MonkeyPatch, fake_session: Any) -> None:
    for mod in (
        admin_billing_payments_mod,
        admin_billing_payment_create_mod,
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
        external_reference = "REF-OUT-1"
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
    assert body1["externalReference"] == "REF-OUT-1"

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


@pytest.mark.parametrize("allocated", ("0", "0.00", "-1"))
def test_create_payment_allocation_rejects_non_positive_allocated_amount(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    allocated: str,
) -> None:
    """Zero or negative allocations violate DB CHECK; reject before flush (no 500)."""
    body = {
        "paymentId": str(uuid4()),
        "invoiceId": str(uuid4()),
        "allocatedAmount": allocated,
        "currency": "HKD",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/allocations",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="greater than zero"):
        admin_billing.handle_admin_billing_request(
            ev, "POST", "/v1/admin/billing/allocations"
        )


def test_next_invoice_number_increments_per_year(
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
    num, seq = customer_billing.next_invoice_number(session)
    assert seq == 1
    assert row.last_number == 1
    assert num.startswith("INV-")
    assert num.count("-") == 2
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
                if "first_name" in sql.lower():
                    out.all.return_value = [(fam_id, "Primary", "Person")]
                else:
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
    assert row0["partyDisplayName"] == "Smith Family · Primary Person"
    assert row0["billToKind"] == "family"
    assert body["items"][1]["partyDisplayName"] == "Smith Family · Primary Person"
    assert body["items"][1]["billToKind"] == "family"


def test_list_recent_enrollments_infers_family_when_bill_to_kind_null(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Legacy enrollments may omit bill_to_kind while still being family-scoped (family_id only)."""

    iid = uuid4()
    fam_id = uuid4()
    ts = datetime(2026, 3, 1, tzinfo=UTC)
    eid = uuid4()

    en = Enrollment(
        instance_id=iid,
        contact_id=None,
        family_id=fam_id,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=None,
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
    en.instance = MagicMock(title="Workshop", cohort=None)
    en.ticket_tier = None
    en.contact = None
    fam_m = MagicMock()
    fam_m.family_name = "Ng Household"
    en.family = fam_m
    en.bill_to_family = fam_m
    en.organization = None
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
            elif "FamilyMember" in sql or "family_members" in sql:
                if "first_name" in sql.lower():
                    out.all.return_value = [(fam_id, "Pat", "Ng")]
                else:
                    out.all.return_value = [(fam_id, "pat.ng@example.com")]
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
    assert body["items"][0]["billToKind"] == "family"
    assert body["items"][0]["partyDisplayName"] == "Ng Household · Pat Ng"


def test_effective_enrollment_bill_to_fks_family_falls_back_to_family_id() -> None:
    """Family-scoped enrollments may set ``family_id`` without ``bill_to_family_id``."""
    iid = uuid4()
    fam_id = uuid4()
    contact_id = uuid4()
    en = Enrollment(
        instance_id=iid,
        contact_id=contact_id,
        family_id=fam_id,
        organization_id=None,
        ticket_tier_id=None,
        discount_code_id=None,
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_contact_id=None,
        bill_to_family_id=None,
        bill_to_organization_id=None,
        status=EnrollmentStatus.CONFIRMED,
        amount_paid=Decimal("10"),
        currency="HKD",
        enrolled_at=datetime(2026, 3, 1, tzinfo=UTC),
        cancelled_at=None,
        notes=None,
        created_by="test",
    )
    bk, cid, fid, oid = effective_enrollment_bill_to_fks(en)
    assert bk == BillingBillToKind.FAMILY
    assert cid is None
    assert fid == fam_id
    assert oid is None
    key = enrollment_bill_to_merge_key(en)
    assert key.startswith("family||")
    assert str(fam_id) in key


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
    org_obj = MagicMock()
    org_obj.name = "Acme Corp"
    en.organization = org_obj
    en.bill_to_contact = None
    en.bill_to_family = None
    en.bill_to_organization = org_obj

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
                if "first_name" in sql.lower():
                    out.all.return_value = [(oid, "Jane", "Doe")]
                else:
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
    assert body["items"][0]["partyDisplayName"] == "Acme Corp · Jane Doe"
    assert body["items"][0]["billToKind"] == "organization"


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
    assert row["billToKind"] == "contact"


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
        amount_allocated = Decimal("0")
        balance_due = Decimal("100")
        paid_at = None
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
        invoice_date = None
        due_date = None
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
    assert body["items"][0]["amountAllocated"] == "0"
    assert body["items"][0]["balanceDue"] == "100"
    assert body["items"][0]["paidAt"] is None
    assert body["items"][0]["isPaid"] is False
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
        amount_allocated = Decimal("0")
        balance_due = Decimal("100")
        paid_at = None
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
        invoice_date = None
        due_date = None
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
    assert body["invoice"]["amountAllocated"] == "0"
    assert body["invoice"]["balanceDue"] == "100"
    assert body["invoice"]["paidAt"] is None
    assert body["invoice"]["isPaid"] is False


def test_delete_draft_invoice_succeeds(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()
    inv = MagicMock()
    inv.id = inv_id
    inv.status = BillingInvoiceStatus.DRAFT

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is CustomerInvoice and pk == inv_id:
                return inv
            return None

        s.get.side_effect = _get
        ex = MagicMock()
        ex.scalar_one.return_value = 0
        s.execute.return_value = ex
        yield s

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **_kw: Any) -> None:
            return None

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(admin_billing_invoices_mod, "AuditService", _FakeAudit)

    ev = api_gateway_event(
        method="DELETE",
        path=f"/v1/admin/billing/invoices/{inv_id}",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "DELETE", f"/v1/admin/billing/invoices/{inv_id}"
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["invoiceId"] == str(inv_id)
    assert body["deleted"] is True


def test_delete_draft_invoice_rejects_issued(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()
    inv = MagicMock()
    inv.id = inv_id
    inv.status = BillingInvoiceStatus.ISSUED

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is CustomerInvoice and pk == inv_id:
                return inv
            return None

        s.get.side_effect = _get
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="DELETE",
        path=f"/v1/admin/billing/invoices/{inv_id}",
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="Only draft"):
        admin_billing.handle_admin_billing_request(
            ev, "DELETE", f"/v1/admin/billing/invoices/{inv_id}"
        )


def test_delete_draft_invoice_rejects_when_allocations_exist(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv_id = uuid4()
    inv = MagicMock()
    inv.id = inv_id
    inv.status = BillingInvoiceStatus.DRAFT

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is CustomerInvoice and pk == inv_id:
                return inv
            return None

        s.get.side_effect = _get
        ex = MagicMock()
        ex.scalar_one.return_value = 1
        s.execute.return_value = ex
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    ev = api_gateway_event(
        method="DELETE",
        path=f"/v1/admin/billing/invoices/{inv_id}",
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="allocations"):
        admin_billing.handle_admin_billing_request(
            ev, "DELETE", f"/v1/admin/billing/invoices/{inv_id}"
        )


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
        inv.amount_allocated = Decimal("0")
        inv.balance_due = Decimal("1")
        inv.paid_at = None
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


def test_list_invoices_filters_by_settlement_open(
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
        query_params={"settlement": "open"},
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 200
    assert captured
    stmt_text = str(captured[0]).lower()
    assert "customer_invoices.balance_due" in stmt_text
    assert "customer_invoices.status" in stmt_text


def test_list_invoices_applies_free_text_query_param(
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
        query_params={"q": "Acme"},
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 200
    assert captured
    stmt_text = str(captured[0]).lower()
    assert "customer_invoices.invoice_number" in stmt_text
    assert "to_char" in stmt_text


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


def test_create_invoice_draft_accepts_invoice_date(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    saved: dict[str, Any] = {}

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

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [fake_en]
            return out

        def _add(obj: Any) -> None:
            if isinstance(obj, CustomerInvoice):
                saved["inv"] = obj

        s.execute.side_effect = _exec
        s.add.side_effect = _add
        s.get.return_value = None
        s.flush = MagicMock()
        yield s

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

    body = {
        "draftKind": "enrollment_merge",
        "enrollmentIds": [str(eid)],
        "invoiceDate": "2024-12-31",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 201
    assert saved["inv"].invoice_date == date(2024, 12, 31)


def test_create_invoice_draft_accepts_invoice_date_at_upper_bound_in_display_tz(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    fixed_today = date(2026, 6, 15)
    monkeypatch.setattr(
        admin_billing_invoice_drafts_mod,
        "today_in_invoice_display_tz_or_utc",
        lambda: fixed_today,
    )
    eid = uuid4()
    saved: dict[str, Any] = {}

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

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [fake_en]
            return out

        def _add(obj: Any) -> None:
            if isinstance(obj, CustomerInvoice):
                saved["inv"] = obj

        s.execute.side_effect = _exec
        s.add.side_effect = _add
        s.get.return_value = None
        s.flush = MagicMock()
        yield s

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

    upper = (fixed_today + timedelta(days=365)).isoformat()
    body = {
        "draftKind": "enrollment_merge",
        "enrollmentIds": [str(eid)],
        "invoiceDate": upper,
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 201
    assert saved["inv"].invoice_date == fixed_today + timedelta(days=365)


def test_create_invoice_draft_defaults_invoice_date_to_today(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    saved: dict[str, Any] = {}

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

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _exec(_stmt: Any, *a: Any, **k: Any) -> MagicMock:
            out = MagicMock()
            out.unique.return_value.scalars.return_value.all.return_value = [fake_en]
            return out

        def _add(obj: Any) -> None:
            if isinstance(obj, CustomerInvoice):
                saved["inv"] = obj

        s.execute.side_effect = _exec
        s.add.side_effect = _add
        s.get.return_value = None
        s.flush = MagicMock()
        yield s

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
    assert saved["inv"].invoice_date is not None
    assert saved["inv"].invoice_date == datetime.now(UTC).date()


def test_create_customized_invoice_draft_accepts_invoice_date(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = uuid4()
    saved: dict[str, Any] = {}

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Contact and pk == cid:
                return MagicMock()
            return None

        def _add(obj: Any) -> None:
            if isinstance(obj, CustomerInvoice):
                saved["inv"] = obj

        s.get.side_effect = _get
        s.add.side_effect = _add
        s.flush = MagicMock()
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

    body = {
        "draftKind": "customized_manual",
        "billTo": {"kind": "contact", "contactId": str(cid)},
        "currency": "HKD",
        "lines": [{"description": "A", "quantity": "1", "unitAmount": "10"}],
        "invoiceDate": "2024-06-15",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert r["statusCode"] == 201
    assert saved["inv"].invoice_date == date(2024, 6, 15)


def test_create_invoice_draft_rejects_invalid_invoice_date(
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

    body = {
        "draftKind": "enrollment_merge",
        "enrollmentIds": [str(eid)],
        "invoiceDate": "not-a-date",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/invoices",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError) as excinfo:
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/invoices")
    assert getattr(excinfo.value, "field", None) == "invoiceDate"


def test_issue_preserves_draft_invoice_date_and_derives_due_date(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    inv_id = uuid4()
    bill_cid = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.DRAFT,
        currency="HKD",
        total=Decimal("100"),
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=bill_cid,
        bill_to_family_id=None,
        bill_to_organization_id=None,
        bill_to_display_name="Pat",
        bill_to_email="p@example.com",
        bill_to_snapshot=None,
        invoice_date=date(2024, 3, 10),
        due_date=None,
        invoice_number=None,
        invoice_sequence=None,
        issued_at=None,
        issued_pdf_sha256="abc",
    )

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is CustomerInvoice and pk == inv_id:
                return inv
            if model is Contact and pk == bill_cid:
                return SimpleNamespace(
                    id=bill_cid,
                    first_name="P",
                    last_name="N",
                    email="p@example.com",
                )
            return None

        s.get.side_effect = _get
        s.flush = MagicMock()
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_invoices_mod,
        "next_invoice_number",
        lambda _session: ("INV-TEST-1", 1),
    )
    monkeypatch.setattr(admin_billing_invoices_mod, "refresh_invoice_pdf", lambda *_a, **_k: None)
    monkeypatch.setattr(
        admin_billing_invoices_mod,
        "recompute_invoice_settlement",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        admin_billing_invoices_mod,
        "AuditService",
        lambda *_a, **_k: MagicMock(log_custom=lambda **_kw: None),
    )

    ev = api_gateway_event(
        method="POST",
        path=f"/v1/admin/billing/invoices/{inv_id}/issue",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "POST", f"/v1/admin/billing/invoices/{inv_id}/issue"
    )
    assert r["statusCode"] == 200
    assert inv.invoice_date == date(2024, 3, 10)
    assert inv.due_date == date(2024, 3, 17)


def test_issue_legacy_draft_without_invoice_date_uses_snapshot(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "UTC")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    fixed_issue = datetime(2026, 6, 15, 14, 0, 0, tzinfo=UTC)

    class _DateTimeShim:
        UTC = UTC

        @staticmethod
        def now(tz: Any = None) -> datetime:
            return fixed_issue

    monkeypatch.setattr(admin_billing_invoices_mod, "datetime", _DateTimeShim)

    inv_id = uuid4()
    bill_cid = uuid4()
    inv = SimpleNamespace(
        id=inv_id,
        status=BillingInvoiceStatus.DRAFT,
        currency="HKD",
        total=Decimal("100"),
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=bill_cid,
        bill_to_family_id=None,
        bill_to_organization_id=None,
        bill_to_display_name="Pat",
        bill_to_email="p@example.com",
        bill_to_snapshot=None,
        invoice_date=None,
        due_date=None,
        invoice_number=None,
        invoice_sequence=None,
        issued_at=None,
        issued_pdf_sha256="abc",
    )

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is CustomerInvoice and pk == inv_id:
                return inv
            if model is Contact and pk == bill_cid:
                return SimpleNamespace(
                    id=bill_cid,
                    first_name="P",
                    last_name="N",
                    email="p@example.com",
                )
            return None

        s.get.side_effect = _get
        s.flush = MagicMock()
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_invoices_mod,
        "next_invoice_number",
        lambda _session: ("INV-TEST-2", 2),
    )
    monkeypatch.setattr(admin_billing_invoices_mod, "refresh_invoice_pdf", lambda *_a, **_k: None)
    monkeypatch.setattr(
        admin_billing_invoices_mod,
        "recompute_invoice_settlement",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        admin_billing_invoices_mod,
        "AuditService",
        lambda *_a, **_k: MagicMock(log_custom=lambda **_kw: None),
    )

    ev = api_gateway_event(
        method="POST",
        path=f"/v1/admin/billing/invoices/{inv_id}/issue",
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(
        ev, "POST", f"/v1/admin/billing/invoices/{inv_id}/issue"
    )
    assert r["statusCode"] == 200
    assert inv.invoice_date == date(2026, 6, 15)
    assert inv.due_date == date(2026, 6, 22)


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


def test_create_payment_requires_direction(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)
    body = {"originalPaymentId": str(uuid4()), "amount": "1", "currency": "HKD"}
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="direction"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_requires_enrollment_id(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        yield MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)
    body = {"direction": "inbound", "amount": "10", "currency": "HKD", "method": "fps"}
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="enrollmentId"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_enrollment_not_found(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Enrollment and pk == eid:
                return None
            return None

        s.get.side_effect = _get
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "10",
        "currency": "HKD",
        "method": "fps",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(NotFoundError, match="Enrollment"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_cancelled_enrollment_rejected(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CANCELLED,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        contact_id=uuid4(),
        currency="HKD",
    )

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: en if model is Enrollment and pk == eid else None
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "10",
        "currency": "HKD",
        "method": "fps",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="cancelled"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_succeeded_creates_receipt(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    cid = uuid4()
    new_pid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        contact_id=cid,
        currency="HKD",
    )
    added: list[Any] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Enrollment and pk == eid:
                return en
            return None

        s.get.side_effect = _get

        def _add(obj: Any) -> None:
            added.append(obj)

        s.add.side_effect = _add

        def _flush() -> None:
            obj = added[-1]
            obj.id = new_pid
            obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        s.flush.side_effect = _flush
        ex = MagicMock()
        ex.scalar_one_or_none.return_value = None
        s.execute.return_value = ex
        yield s

    created = {"n": 0}

    def _create_rcpt(_session: Any, *, payment: Any) -> MagicMock:
        created["n"] += 1
        return MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "_batch_orphan_payment_deletable",
        lambda _session, rows: {rows[0].id: False},
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "create_receipt_for_succeeded_inbound_payment",
        _create_rcpt,
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "finalize_receipt_pdf_upload",
        lambda *_a, **_k: None,
    )

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **_kw: Any) -> None:
            return None

    monkeypatch.setattr(admin_billing_payment_create_mod, "AuditService", _FakeAudit)

    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "50",
        "currency": "HKD",
        "method": "bank_transfer",
        "status": "succeeded",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")
    assert r["statusCode"] == 201
    assert created["n"] == 1
    out = json.loads(r["body"])
    assert out["payment"]["enrollmentId"] == str(eid)
    assert out["payment"]["status"] == "succeeded"


def test_manual_inbound_payment_pending_skips_receipt(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    cid = uuid4()
    new_pid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        contact_id=cid,
        currency="HKD",
    )
    added: list[Any] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Enrollment and pk == eid:
                return en
            return None

        s.get.side_effect = _get

        def _add(obj: Any) -> None:
            added.append(obj)

        def _flush() -> None:
            obj = added[-1]
            obj.id = new_pid
            obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        s.add.side_effect = _add
        s.flush.side_effect = _flush
        yield s

    created = {"n": 0}

    def _create_rcpt(_session: Any, *, payment: Any) -> MagicMock:
        created["n"] += 1
        return MagicMock()

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "_batch_orphan_payment_deletable",
        lambda _session, rows: {rows[0].id: False},
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "create_receipt_for_succeeded_inbound_payment",
        _create_rcpt,
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "finalize_receipt_pdf_upload",
        lambda *_a, **_k: None,
    )

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **_kw: Any) -> None:
            return None

    monkeypatch.setattr(admin_billing_payment_create_mod, "AuditService", _FakeAudit)

    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "50",
        "currency": "HKD",
        "method": "bank_transfer",
        "status": "pending",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")
    assert r["statusCode"] == 201
    assert created["n"] == 0
    out = json.loads(r["body"])
    assert out["payment"]["status"] == "pending"


def test_manual_inbound_payment_family_enrollment_recorded(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    new_pid = uuid4()
    fid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_contact_id=None,
        bill_to_family_id=None,
        contact_id=None,
        family_id=fid,
        currency="HKD",
    )
    added: list[Any] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Enrollment and pk == eid:
                return en
            return None

        s.get.side_effect = _get

        def _add(obj: Any) -> None:
            added.append(obj)

        def _flush() -> None:
            obj = added[-1]
            obj.id = new_pid
            obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)
            obj.external_reference = None

        s.add.side_effect = _add
        s.flush.side_effect = _flush
        ex = MagicMock()
        ex.scalar_one_or_none.return_value = None
        s.execute.return_value = ex
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "_batch_orphan_payment_deletable",
        lambda _session, rows: {rows[0].id: False},
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "create_receipt_for_succeeded_inbound_payment",
        lambda *_a, **_k: MagicMock(),
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "finalize_receipt_pdf_upload",
        lambda *_a, **_k: None,
    )

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **_kw: Any) -> None:
            return None

    monkeypatch.setattr(admin_billing_payment_create_mod, "AuditService", _FakeAudit)

    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "25",
        "currency": "HKD",
        "method": "fps",
        "status": "pending",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")
    assert r["statusCode"] == 201
    out = json.loads(r["body"])
    assert out["payment"]["contactId"] is None
    assert out["payment"]["enrollmentId"] == str(eid)


def test_manual_inbound_payment_rejects_currency_mismatch(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    cid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        contact_id=cid,
        currency="USD",
    )

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: en if model is Enrollment and pk == eid else None
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "10",
        "currency": "HKD",
        "method": "fps",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="currency"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_unknown_method_rejected(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    cid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.CONTACT,
        contact_id=cid,
        currency="HKD",
    )

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: en if model is Enrollment and pk == eid else None
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)
    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "10",
        "currency": "HKD",
        "method": "under_the_table",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="method"):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_duplicate_external_reference_conflict(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import IntegrityError

    eid = uuid4()
    cid = uuid4()
    new_pid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        contact_id=cid,
        currency="HKD",
    )
    added: list[Any] = []

    class _Orig:
        def __str__(self) -> str:
            return 'duplicate key value violates unique constraint "uq_cp_enrollment_external_ref"'

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Enrollment and pk == eid:
                return en
            return None

        s.get.side_effect = _get

        def _add(obj: Any) -> None:
            added.append(obj)

        def _flush() -> None:
            if not added:
                return
            obj = added[-1]
            obj.id = new_pid
            obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)
            raise IntegrityError("stmt", {}, _Orig())

        s.add.side_effect = _add
        s.flush.side_effect = _flush
        yield s

    _patch_billing_sessions(monkeypatch, _fake_session)

    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "10",
        "currency": "HKD",
        "method": "fps",
        "externalReference": "dup-ref",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ConflictError):
        admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")


def test_manual_inbound_payment_audit_includes_reconciliation_fields(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    eid = uuid4()
    cid = uuid4()
    new_pid = uuid4()
    en = SimpleNamespace(
        id=eid,
        status=EnrollmentStatus.CONFIRMED,
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=None,
        contact_id=cid,
        currency="HKD",
    )
    added: list[Any] = []
    audit_calls: list[dict[str, Any]] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()

        def _get(model: Any, pk: Any) -> Any:
            if model is Enrollment and pk == eid:
                return en
            return None

        s.get.side_effect = _get

        def _add(obj: Any) -> None:
            added.append(obj)

        def _flush() -> None:
            obj = added[-1]
            obj.id = new_pid
            obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        s.add.side_effect = _add
        s.flush.side_effect = _flush
        ex = MagicMock()
        ex.scalar_one_or_none.return_value = None
        s.execute.return_value = ex
        yield s

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **kw: Any) -> None:
            audit_calls.append(kw)

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(
        admin_billing_payments_mod,
        "_batch_orphan_payment_deletable",
        lambda _session, rows: {rows[0].id: False},
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "create_receipt_for_succeeded_inbound_payment",
        lambda *_a, **_k: MagicMock(),
    )
    monkeypatch.setattr(
        admin_billing_payment_create_mod,
        "finalize_receipt_pdf_upload",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(admin_billing_payment_create_mod, "AuditService", _FakeAudit)

    body = {
        "direction": "inbound",
        "enrollmentId": str(eid),
        "amount": "50",
        "currency": "HKD",
        "method": "bank_transfer",
        "status": "succeeded",
        "externalReference": "wire-123",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")
    assert r["statusCode"] == 201
    assert len(audit_calls) == 1
    nv = audit_calls[0]["new_values"]
    assert nv["external_reference"] == "wire-123"
    assert nv["contact_id"] == str(cid)
    assert "succeeded_at" in nv


def test_refund_created_audit_includes_reconciliation_fields(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    orig_id = uuid4()
    new_pid = uuid4()
    audit_calls: list[dict[str, Any]] = []

    class _Orig:
        id = orig_id
        currency = "HKD"

    added: list[Any] = []

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        s.get.side_effect = lambda model, pk: _Orig() if model is CustomerPayment and pk == orig_id else None

        def _add(obj: Any) -> None:
            added.append(obj)

        def _flush() -> None:
            obj = added[-1]
            obj.id = new_pid
            obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        s.add.side_effect = _add
        s.flush.side_effect = _flush
        yield s

    class _FakeAudit:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def log_custom(self, **kw: Any) -> None:
            audit_calls.append(kw)

    _patch_billing_sessions(monkeypatch, _fake_session)
    monkeypatch.setattr(admin_billing_payment_create_mod, "AuditService", _FakeAudit)

    body = {
        "direction": "refund",
        "originalPaymentId": str(orig_id),
        "amount": "5",
        "currency": "HKD",
        "method": "refund",
        "stripeRefundId": "re_abc",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/payments",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/payments")
    assert r["statusCode"] == 201
    assert len(audit_calls) == 1
    nv = audit_calls[0]["new_values"]
    assert nv["original_payment_id"] == str(orig_id)
    assert nv["currency"] == "HKD"
    assert nv["method"] == "refund"
    assert nv["stripe_refund_id"] == "re_abc"
    assert nv["contact_id"] is None
    assert nv["external_reference"] is None
    assert "succeeded_at" in nv


def test_family_or_organization_bill_to_display_label() -> None:
    from app.api.admin_billing_common import family_or_organization_bill_to_display_label

    assert (
        family_or_organization_bill_to_display_label(
            entity_name="Smith Family",
            primary_display_name="Jane Doe",
        )
        == "Smith Family \u00b7 Jane Doe"
    )
    assert (
        family_or_organization_bill_to_display_label(
            entity_name="Acme Ltd",
            primary_display_name=None,
        )
        == "Acme Ltd"
    )
    assert (
        family_or_organization_bill_to_display_label(
            entity_name=None,
            primary_display_name="Pat Lee",
        )
        == "Pat Lee"
    )
    assert family_or_organization_bill_to_display_label(
        entity_name="  ",
        primary_display_name="  ",
    ) is None


def test_compose_enrollment_party_display_name_contact_includes_email_when_known() -> None:
    from types import SimpleNamespace

    from app.api.admin_billing_common import compose_enrollment_party_display_name
    from app.db.models.enums import BillingBillToKind

    contact = SimpleNamespace(first_name="Sam", last_name="Sample", email="sam@example.com")
    enrollment = SimpleNamespace(
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact=None,
        contact=contact,
        bill_to_family_id=None,
        family_id=None,
        bill_to_organization_id=None,
        organization_id=None,
        bill_to_family=None,
        family=None,
        bill_to_organization=None,
        organization=None,
    )
    assert (
        compose_enrollment_party_display_name(
            enrollment,
            family_primary_contact_name=None,
            org_primary_contact_name=None,
        )
        == "Sam Sample \u00b7 sam@example.com"
    )


def test_resolve_bill_to_party_from_invoice_fks_family_uses_primary_contact_only() -> None:
    """Family invoices show primary contact as bill-to display name (no family · name line)."""
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Family

    fid = uuid4()
    fam = SimpleNamespace(family_name="The Ng Household")
    primary = SimpleNamespace(
        first_name="Pat",
        last_name="Ng",
        email="pat@example.com",
    )
    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Family and pk == fid:
            return fam
        return None

    session.get.side_effect = _get

    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = primary
    session.execute.return_value = exec_result

    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_family_id=fid,
        bill_to_display_name=None,
        bill_to_email=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_display_name == "Pat Ng"
    assert inv.bill_to_email == "pat@example.com"


def test_resolve_bill_to_party_from_invoice_fks_family_without_primary_name() -> None:
    """When no primary contact name exists, family bill-to omits the family entity label."""
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Family

    fid = uuid4()
    fam = SimpleNamespace(family_name="Orphan Household")
    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Family and pk == fid:
            return fam
        return None

    session.get.side_effect = _get

    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = None
    session.execute.return_value = exec_result

    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_family_id=fid,
        bill_to_display_name=None,
        bill_to_email=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_display_name is None


def test_build_enrollment_merge_line_description_title_tier_cohort() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _build_enrollment_merge_line_description,
    )

    svc = SimpleNamespace(
        title="Parent Service",
        service_tier="premium",
        service_type=ServiceType.EVENT,
    )
    inst = SimpleNamespace(title=None, cohort="spring 2026", service=svc)
    en = SimpleNamespace(
        instance=inst,
        ticket_tier_id=None,
        ticket_tier=None,
    )
    assert (
        _build_enrollment_merge_line_description(en)  # type: ignore[arg-type]
        == "Event: Parent Service Premium Spring 2026"
    )


def test_build_enrollment_merge_line_description_prefers_instance_title_and_ticket_tier() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _build_enrollment_merge_line_description,
    )

    tier = SimpleNamespace(name="early bird")
    svc = SimpleNamespace(
        title="Event Parent",
        service_tier="ignored_when_ticket",
        service_type=ServiceType.EVENT,
    )
    inst = SimpleNamespace(title="June Weekend", cohort=None, service=svc)
    tt_id = uuid4()
    en = SimpleNamespace(
        instance=inst,
        ticket_tier_id=tt_id,
        ticket_tier=tier,
    )
    assert (
        _build_enrollment_merge_line_description(en)  # type: ignore[arg-type]
        == "Event: June Weekend Early bird"
    )


def test_build_enrollment_merge_line_description_dedupes_when_tail_matches_kind() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _build_enrollment_merge_line_description,
    )

    svc = SimpleNamespace(title="Event", service_tier=None, service_type=ServiceType.EVENT)
    inst = SimpleNamespace(title="Event", cohort=None, service=svc)
    en = SimpleNamespace(
        instance=inst,
        ticket_tier_id=None,
        ticket_tier=None,
    )
    assert (
        _build_enrollment_merge_line_description(en)  # type: ignore[arg-type]
        == "Event"
    )


def test_build_enrollment_merge_line_description_same_instance_and_service_title() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _build_enrollment_merge_line_description,
    )

    svc = SimpleNamespace(
        title="Holiday Workshop",
        service_tier="standard",
        service_type=ServiceType.TRAINING_COURSE,
    )
    inst = SimpleNamespace(title="Holiday Workshop", cohort="week 1", service=svc)
    en = SimpleNamespace(
        instance=inst,
        ticket_tier_id=None,
        ticket_tier=None,
    )
    assert (
        _build_enrollment_merge_line_description(en)  # type: ignore[arg-type]
        == "Training course: Holiday Workshop Standard Week 1"
    )


def test_build_enrollment_merge_line_description_instance_title_without_service_title() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _build_enrollment_merge_line_description,
    )

    svc = SimpleNamespace(
        title=None,
        service_tier="solo",
        service_type=ServiceType.CONSULTATION,
    )
    inst = SimpleNamespace(title="Drop-in Session", cohort=None, service=svc)
    en = SimpleNamespace(
        instance=inst,
        ticket_tier_id=None,
        ticket_tier=None,
    )
    assert (
        _build_enrollment_merge_line_description(en)  # type: ignore[arg-type]
        == "Consultation: Drop-in Session Solo"
    )


def test_resolve_bill_to_party_from_invoice_fks_organization_two_lines() -> None:
    """Organization invoices store entity and primary contact on separate lines (PDF breaks)."""
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Organization

    oid = uuid4()
    org = SimpleNamespace(name="Acme Learning Ltd")
    primary = SimpleNamespace(
        first_name="Jordan",
        last_name="Lee",
        email="jordan@example.com",
    )
    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Organization and pk == oid:
            return org
        return None

    session.get.side_effect = _get

    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = primary
    session.execute.return_value = exec_result

    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.ORGANIZATION,
        bill_to_organization_id=oid,
        bill_to_display_name=None,
        bill_to_email=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_display_name == "Acme Learning Ltd\nJordan Lee"
    assert inv.bill_to_email == "jordan@example.com"


def test_resolve_bill_to_party_from_invoice_fks_contact_without_email_sets_display_name() -> None:
    """Contact bill-to must populate display name even when email is absent (list + PDF)."""
    from types import SimpleNamespace

    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Contact

    cid = uuid4()
    contact = SimpleNamespace(email=None, first_name="Pat", last_name="Ng")
    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Contact and pk == cid:
            return contact
        return None

    session.get.side_effect = _get
    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=cid,
        bill_to_display_name=None,
        bill_to_email=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_display_name == "Pat Ng"
    assert inv.bill_to_email is None


def test_resolve_bill_to_party_from_invoice_fks_contact_includes_location_text() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Contact, Location

    cid = uuid4()
    lid = uuid4()
    contact = SimpleNamespace(
        email="p@example.com",
        first_name="Pat",
        last_name="Ng",
        location_id=lid,
    )
    loc = SimpleNamespace(name="Harbour Studio", address="1 Pier\nCentral")

    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Contact and pk == cid:
            return contact
        if model is Location and pk == lid:
            return loc
        return None

    session.get.side_effect = _get
    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.CONTACT,
        bill_to_contact_id=cid,
        bill_to_display_name=None,
        bill_to_email=None,
        bill_to_location_text=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_location_text == "Harbour Studio\n1 Pier\nCentral"


def test_resolve_bill_to_party_from_invoice_fks_family_primary_location_fallback() -> None:
    """When family has no location, use primary contact's linked location.

    The family bill-to snapshot intentionally drops ``Location.name`` (venue label) so
    family-affiliated locations don't duplicate the household name in the Bill To block.
    """
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Family, Location

    fid = uuid4()
    lid = uuid4()
    fam = SimpleNamespace(family_name="Ng Family", location_id=None)
    primary = SimpleNamespace(
        first_name="Pat",
        last_name="Ng",
        email="pat@example.com",
        location_id=lid,
    )
    loc = SimpleNamespace(name="Home Base", address="99 Road")

    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Family and pk == fid:
            return fam
        if model is Location and pk == lid:
            return loc
        return None

    session.get.side_effect = _get

    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = primary
    session.execute.return_value = exec_result

    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_family_id=fid,
        bill_to_display_name=None,
        bill_to_email=None,
        bill_to_location_text=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_location_text == "99 Road"


def test_resolve_bill_to_party_from_invoice_fks_family_prefers_family_location() -> None:
    """Family-level location wins over primary contact location.

    The family branch drops ``Location.name`` from the snapshot so the assertion uses a
    distinctive ``address`` to verify which Location was chosen.
    """
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Family, Location

    fid = uuid4()
    fam_lid = uuid4()
    primary_lid = uuid4()
    fam = SimpleNamespace(family_name="Ng Family", location_id=fam_lid)
    primary = SimpleNamespace(
        first_name="Pat",
        last_name="Ng",
        email="pat@example.com",
        location_id=primary_lid,
    )
    fam_loc = SimpleNamespace(name="Family Venue", address="2 Family Road")
    primary_loc = SimpleNamespace(name="Wrong", address="99 Other Road")

    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Family and pk == fid:
            return fam
        if model is Location and pk == fam_lid:
            return fam_loc
        if model is Location and pk == primary_lid:
            return primary_loc
        return None

    session.get.side_effect = _get

    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = primary
    session.execute.return_value = exec_result

    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_family_id=fid,
        bill_to_display_name=None,
        bill_to_email=None,
        bill_to_location_text=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_location_text == "2 Family Road"


def test_resolve_bill_to_party_from_invoice_fks_family_excludes_venue_name() -> None:
    """Family bill-to drops the venue label even when address is empty."""
    from app.api.admin_billing_invoice_draft_helpers import (
        _resolve_bill_to_party_from_invoice_fks,
    )
    from app.db.models import Family, Location

    fid = uuid4()
    lid = uuid4()
    fam = SimpleNamespace(family_name="Ng Family", location_id=lid)
    primary = SimpleNamespace(
        first_name="Pat",
        last_name="Ng",
        email="pat@example.com",
        location_id=None,
    )
    loc = SimpleNamespace(name="Ng Family Home", address=None)

    session = MagicMock()

    def _get(model: Any, pk: Any) -> Any:
        if model is Family and pk == fid:
            return fam
        if model is Location and pk == lid:
            return loc
        return None

    session.get.side_effect = _get

    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = primary
    session.execute.return_value = exec_result

    inv = SimpleNamespace(
        bill_to_kind=BillingBillToKind.FAMILY,
        bill_to_family_id=fid,
        bill_to_display_name=None,
        bill_to_email=None,
        bill_to_location_text=None,
    )
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)  # type: ignore[arg-type]
    assert inv.bill_to_location_text is None


def test_bill_to_location_snapshot_text_includes_geo_district_and_country() -> None:
    from app.api.admin_billing_invoice_draft_helpers import (
        _bill_to_location_snapshot_text,
    )
    from app.db.models import GeographicArea, Location

    lid = uuid4()
    area_leaf = uuid4()
    area_root = uuid4()
    loc = SimpleNamespace(name="Venue", address="99 Road", area_id=area_leaf)
    district = SimpleNamespace(
        id=area_leaf,
        name="Central",
        level="district",
        parent_id=area_root,
    )
    country = SimpleNamespace(
        id=area_root,
        name="Hong Kong",
        level="country",
        parent_id=None,
    )

    def _get(model: Any, pk: Any) -> Any:
        if model is Location and pk == lid:
            return loc
        if model is GeographicArea and pk == area_leaf:
            return district
        if model is GeographicArea and pk == area_root:
            return country
        return None

    session = MagicMock()
    session.get.side_effect = _get
    out = _bill_to_location_snapshot_text(session, lid)  # type: ignore[arg-type]
    assert out == "Venue\n99 Road\nCentral\nHong Kong"


def test_parse_optional_invoice_settlement_accepts_known_values() -> None:
    assert parse_optional_invoice_settlement(None) is None
    assert parse_optional_invoice_settlement("") is None
    assert parse_optional_invoice_settlement("OPEN") == "open"
    assert parse_optional_invoice_settlement("partially_paid") == "partially_paid"


def test_parse_optional_invoice_settlement_rejects_unknown() -> None:
    with pytest.raises(ValidationError, match="settlement"):
        parse_optional_invoice_settlement("overdue")


def test_list_invoices_rejects_invalid_settlement_query_param(
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
        path="/v1/admin/billing/invoices",
        query_params={"settlement": "bogus"},
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="settlement"):
        admin_billing.handle_admin_billing_request(ev, "GET", "/v1/admin/billing/invoices")


def test_create_allocation_calls_recompute_invoice_settlement(
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pay_id = uuid4()
    inv_id = uuid4()
    touched: list[UUID] = []

    class _Pay:
        id = pay_id
        currency = "HKD"

    class _Inv:
        id = inv_id
        currency = "HKD"
        status = BillingInvoiceStatus.ISSUED

    def _spy_recompute(_session: Any, inv: Any) -> None:
        touched.append(inv.id)

    monkeypatch.setattr(
        admin_billing_allocations_mod,
        "recompute_invoice_settlement",
        _spy_recompute,
    )
    monkeypatch.setattr(
        admin_billing_allocations_mod,
        "maybe_confirm_enrollments_on_positive_invoice_payment_allocation",
        lambda _s, _i: None,
    )
    monkeypatch.setattr(
        admin_billing_allocations_mod,
        "payment_unapplied_amount",
        lambda _s, _pid: Decimal("500"),
    )

    @contextmanager
    def _fake_session(_u: str, _r: str | None) -> Any:
        s = MagicMock()
        pay_res = MagicMock()
        pay_res.scalar_one_or_none.return_value = _Pay()
        s.execute.return_value = pay_res
        s.get.return_value = _Inv()
        yield s

    monkeypatch.setattr(admin_billing_allocations_mod, "_session_with_audit", _fake_session)

    body = {
        "paymentId": str(pay_id),
        "invoiceId": str(inv_id),
        "allocatedAmount": "10",
        "currency": "HKD",
    }
    ev = api_gateway_event(
        method="POST",
        path="/v1/admin/billing/allocations",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    r = admin_billing.handle_admin_billing_request(ev, "POST", "/v1/admin/billing/allocations")
    assert r["statusCode"] == 201
    assert touched == [inv_id]
