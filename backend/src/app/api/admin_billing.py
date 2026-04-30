"""Admin customer billing (AR) API."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.admin_request import parse_body, parse_uuid, request_id
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import AuditService, set_audit_context
from app.db.engine import get_engine
from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models import Enrollment
from app.db.models.enums import (
    BillingBillToKind,
    BillingInvoiceStatus,
    BillingPaymentDirection,
    BillingPaymentStatus,
)
from app.db.models.payment_allocation import PaymentAllocation
from app.exceptions import NotFoundError, ValidationError
from app.services.customer_billing import (
    create_receipt_for_succeeded_inbound_payment,
    next_invoice_number,
    payment_unapplied_amount,
    refresh_invoice_pdf,
    send_invoice_email,
)
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_DEFAULT_LIMIT = 50


def handle_admin_billing_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Route /v1/admin/billing/*."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "billing":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    req = request_id(event)

    if len(parts) < 3:
        return json_response(404, {"error": "Not found"}, event=event)

    sub = parts[2]

    if sub == "export" and method == "GET" and len(parts) == 3:
        return _export_csv(event, user_sub=identity.user_sub, request_id=req)

    if sub == "payments" and len(parts) == 3:
        if method == "GET":
            return _list_payments(event, user_sub=identity.user_sub, request_id=req)
        if method == "POST":
            return _create_payment(event, user_sub=identity.user_sub, request_id=req)

    if sub == "payments" and len(parts) == 4:
        pid = parse_uuid(parts[3])
        if method == "GET":
            return _get_payment(event, pid, user_sub=identity.user_sub, request_id=req)

    if sub == "payments" and len(parts) == 5 and parts[4] == "unapplied":
        pid = parse_uuid(parts[3])
        if method == "GET":
            return _unapplied(event, pid, user_sub=identity.user_sub, request_id=req)

    if sub == "payments" and len(parts) == 5 and parts[4] == "confirm":
        pid = parse_uuid(parts[3])
        if method == "POST":
            return _confirm_payment(
                event, pid, user_sub=identity.user_sub, request_id=req
            )

    if sub == "invoices" and len(parts) == 3:
        if method == "POST":
            return _create_invoice_draft(
                event, user_sub=identity.user_sub, request_id=req
            )

    if sub == "invoices" and len(parts) == 5:
        inv_id = parse_uuid(parts[3])
        action = parts[4]
        if action == "issue" and method == "POST":
            return _issue_invoice(
                event, inv_id, user_sub=identity.user_sub, request_id=req
            )
        if action == "void" and method == "POST":
            return _void_invoice(
                event, inv_id, user_sub=identity.user_sub, request_id=req
            )
        if action == "email" and method == "POST":
            return _email_invoice(
                event, inv_id, user_sub=identity.user_sub, request_id=req
            )

    if sub == "allocations" and len(parts) == 3 and method == "POST":
        return _create_allocation(event, user_sub=identity.user_sub, request_id=req)

    return json_response(404, {"error": "Not found"}, event=event)


def _session_with_audit(user_sub: str, request_id_val: str | None) -> Session:
    session = Session(get_engine())
    set_audit_context(session, user_id=user_sub, request_id=request_id_val)
    return session


def _serialize_payment(p: CustomerPayment) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "direction": p.direction.value,
        "status": p.status.value,
        "method": p.method,
        "amount": str(p.amount),
        "currency": p.currency,
        "originalPaymentId": str(p.original_payment_id)
        if p.original_payment_id
        else None,
        "stripePaymentIntentId": p.stripe_payment_intent_id,
        "stripeRefundId": p.stripe_refund_id,
        "enrollmentId": str(p.enrollment_id) if p.enrollment_id else None,
        "contactId": str(p.contact_id) if p.contact_id else None,
        "succeededAt": p.succeeded_at.isoformat() if p.succeeded_at else None,
        "createdAt": p.created_at.isoformat(),
    }


def _list_payments(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        stmt = (
            select(CustomerPayment)
            .order_by(CustomerPayment.created_at.desc())
            .limit(_DEFAULT_LIMIT)
        )
        rows = list(session.execute(stmt).scalars().all())
        return json_response(
            200,
            {"items": [_serialize_payment(p) for p in rows]},
            event=event,
        )


def _get_payment(
    event: Mapping[str, Any],
    payment_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        p = session.get(CustomerPayment, payment_id)
        if p is None:
            raise NotFoundError("CustomerPayment", str(payment_id))
        unapplied = str(payment_unapplied_amount(session, payment_id))
        return json_response(
            200,
            {**_serialize_payment(p), "unappliedAmount": unapplied},
            event=event,
        )


def _unapplied(
    event: Mapping[str, Any],
    payment_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        p = session.get(CustomerPayment, payment_id)
        if p is None:
            raise NotFoundError("CustomerPayment", str(payment_id))
        u = payment_unapplied_amount(session, payment_id)
        return json_response(
            200,
            {"paymentId": str(payment_id), "unappliedAmount": str(u)},
            event=event,
        )


def _create_payment(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    body = parse_body(event)
    direction = str(body.get("direction") or "inbound").strip().lower()
    if direction != "refund":
        raise ValidationError(
            "Only refund creates are supported on this endpoint; "
            "use POST .../payments/{id}/confirm for pending inbound",
            field="direction",
        )

    oid = body.get("originalPaymentId") or body.get("original_payment_id")
    if not oid:
        raise ValidationError(
            "originalPaymentId is required", field="originalPaymentId"
        )
    orig_id = UUID(str(oid))
    amount = Decimal(str(body.get("amount")))
    currency = str(body.get("currency") or "").upper()[:3]
    if len(currency) != 3:
        raise ValidationError("currency is required", field="currency")

    with _session_with_audit(user_sub, request_id) as session:
        orig = session.get(CustomerPayment, orig_id)
        if orig is None:
            raise NotFoundError("CustomerPayment", str(orig_id))
        if orig.currency != currency:
            raise ValidationError(
                "Refund currency must match original payment currency",
                field="currency",
            )
        refund = CustomerPayment(
            direction=BillingPaymentDirection.REFUND,
            status=BillingPaymentStatus.SUCCEEDED,
            method=str(body.get("method") or "refund")[:64],
            amount=amount,
            currency=currency,
            original_payment_id=orig_id,
            stripe_refund_id=str(body.get("stripeRefundId") or "").strip() or None,
            succeeded_at=datetime.now(UTC),
            confirmed_by=user_sub,
        )
        session.add(refund)
        session.flush()
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_payments",
            record_id=refund.id,
            action="REFUND_CREATED",
            new_values={"original_payment_id": str(orig_id), "amount": str(amount)},
        )
        payload = _serialize_payment(refund)
        session.commit()
    return json_response(201, {"payment": payload}, event=event)


def _confirm_payment(
    event: Mapping[str, Any],
    payment_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event) if event.get("body") else {}
    with _session_with_audit(user_sub, request_id) as session:
        p = session.get(CustomerPayment, payment_id)
        if p is None:
            raise NotFoundError("CustomerPayment", str(payment_id))
        if p.status != BillingPaymentStatus.PENDING:
            raise ValidationError("Payment is not pending", field="paymentId")
        p.status = BillingPaymentStatus.SUCCEEDED
        p.succeeded_at = datetime.now(UTC)
        p.confirmed_by = user_sub
        p.external_reference = (
            str(
                body.get("externalReference") or body.get("external_reference") or ""
            ).strip()
            or None
        )
        session.flush()
        existing_receipt = session.execute(
            select(CustomerReceipt).where(CustomerReceipt.customer_payment_id == p.id)
        ).scalar_one_or_none()
        if existing_receipt is None:
            create_receipt_for_succeeded_inbound_payment(session, payment=p)
        out = _serialize_payment(p)
        session.commit()
    return json_response(200, {"payment": out}, event=event)


def _enrollment_merge_key(en: Enrollment) -> tuple[Any, ...]:
    bk = en.bill_to_kind or BillingBillToKind.CONTACT
    return (
        bk,
        en.bill_to_contact_id,
        en.bill_to_family_id,
        en.bill_to_organization_id,
    )


def _create_invoice_draft(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    body = parse_body(event)
    raw_ids = body.get("enrollmentIds") or body.get("enrollment_ids")
    if not isinstance(raw_ids, list) or not raw_ids:
        raise ValidationError("enrollmentIds is required", field="enrollmentIds")
    eids = [UUID(str(x)) for x in raw_ids]
    currency = str(body.get("currency") or "").upper()[:3]
    if len(currency) != 3:
        raise ValidationError("currency is required", field="currency")

    with _session_with_audit(user_sub, request_id) as session:
        enrollments: list[Enrollment] = []
        for eid in eids:
            en = (
                session.execute(
                    select(Enrollment)
                    .where(Enrollment.id == eid)
                    .options(
                        joinedload(Enrollment.instance),
                        joinedload(Enrollment.contact),
                    )
                )
                .unique()
                .scalar_one_or_none()
            )
            if en is None:
                raise ValidationError(
                    f"Enrollment not found: {eid}", field="enrollmentIds"
                )
            ec = (en.currency or "HKD").upper()[:3]
            if ec != currency:
                raise ValidationError(
                    "All enrollments must match invoice currency",
                    field="currency",
                )
            enrollments.append(en)

        keys = {_enrollment_merge_key(e) for e in enrollments}
        if len(keys) != 1:
            raise ValidationError(
                "Merged invoice requires identical bill-to on all enrollments",
                field="enrollmentIds",
            )

        first = enrollments[0]
        bill_kind = first.bill_to_kind or BillingBillToKind.CONTACT
        inv = CustomerInvoice(
            status=BillingInvoiceStatus.DRAFT,
            currency=currency,
            subtotal=Decimal("0"),
            tax_total=Decimal("0"),
            total=Decimal("0"),
            bill_to_kind=bill_kind,
            bill_to_contact_id=first.bill_to_contact_id or first.contact_id,
            bill_to_family_id=first.bill_to_family_id,
            bill_to_organization_id=first.bill_to_organization_id,
        )
        if first.contact and first.contact.email:
            inv.bill_to_email = first.contact.email
            inv.bill_to_display_name = (
                " ".join(
                    x for x in [first.contact.first_name, first.contact.last_name] if x
                ).strip()
                or None
            )

        session.add(inv)
        session.flush()

        subtotal = Decimal("0")
        tax_total = Decimal("0")
        for order, en in enumerate(enrollments):
            title = ""
            if en.instance:
                title = (en.instance.title or "").strip()
            line_total = en.amount_paid or Decimal("0")
            desc = title or "Enrollment"
            line = CustomerInvoiceLine(
                invoice_id=inv.id,
                enrollment_id=en.id,
                line_order=order,
                description=desc[:500],
                quantity=Decimal("1"),
                unit_amount=line_total,
                line_total=line_total,
                currency=currency,
            )
            session.add(line)
            subtotal += line_total

        inv.subtotal = subtotal
        inv.tax_total = tax_total
        inv.total = subtotal + tax_total
        session.flush()

        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_invoices",
            record_id=inv.id,
            action="DRAFT_CREATED",
            new_values={"enrollment_ids": [str(x) for x in eids]},
        )
        session.commit()

        return json_response(
            201,
            {"invoiceId": str(inv.id), "status": inv.status.value},
            event=event,
        )


def _issue_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        inv = session.get(CustomerInvoice, invoice_id)
        if inv is None:
            raise NotFoundError("CustomerInvoice", str(invoice_id))
        if inv.status != BillingInvoiceStatus.DRAFT:
            raise ValidationError("Invoice is not draft", field="invoiceId")

        num, seq = next_invoice_number(session, currency=inv.currency)
        inv.invoice_number = num
        inv.invoice_sequence = seq
        inv.status = BillingInvoiceStatus.ISSUED
        inv.issued_at = datetime.now(UTC)
        session.flush()
        refresh_invoice_pdf(session, inv)
        session.commit()

        return json_response(
            200,
            {
                "invoiceId": str(inv.id),
                "invoiceNumber": inv.invoice_number,
                "issuedPdfSha256": inv.issued_pdf_sha256,
            },
            event=event,
        )


def _void_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event)
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise ValidationError("reason is required", field="reason")
    with _session_with_audit(user_sub, request_id) as session:
        inv = session.get(CustomerInvoice, invoice_id)
        if inv is None:
            raise NotFoundError("CustomerInvoice", str(invoice_id))
        inv.status = BillingInvoiceStatus.VOID
        inv.voided_at = datetime.now(UTC)
        inv.void_reason = reason[:2000]
        session.commit()
        return json_response(
            200, {"invoiceId": str(inv.id), "status": "void"}, event=event
        )


def _email_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event)
    to_email = str(body.get("toEmail") or body.get("to_email") or "").strip()
    if not to_email:
        raise ValidationError("toEmail is required", field="toEmail")
    with _session_with_audit(user_sub, request_id) as session:
        send_invoice_email(session, invoice_id=invoice_id, to_email=to_email)
        session.commit()
        return json_response(200, {"sent": True}, event=event)


def _create_allocation(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    body = parse_body(event)
    payment_id = UUID(str(body.get("paymentId") or body.get("payment_id")))
    invoice_id = UUID(str(body.get("invoiceId") or body.get("invoice_id")))
    amt = Decimal(str(body.get("allocatedAmount") or body.get("allocated_amount")))
    currency = str(body.get("currency") or "").upper()[:3]
    line_id_raw = body.get("invoiceLineId") or body.get("invoice_line_id")
    line_id = UUID(str(line_id_raw)) if line_id_raw else None

    with _session_with_audit(user_sub, request_id) as session:
        pay = session.execute(
            select(CustomerPayment)
            .where(CustomerPayment.id == payment_id)
            .with_for_update()
        ).scalar_one_or_none()
        inv = session.get(CustomerInvoice, invoice_id)
        if pay is None or inv is None:
            raise NotFoundError(
                "PaymentAllocationTarget",
                f"{payment_id}/{invoice_id}",
            )
        if pay.currency != currency or inv.currency != currency:
            raise ValidationError("Currency mismatch", field="currency")
        unapplied = payment_unapplied_amount(session, payment_id)
        if amt > unapplied:
            raise ValidationError(
                "Allocation exceeds unapplied amount", field="allocatedAmount"
            )
        alloc = PaymentAllocation(
            payment_id=payment_id,
            invoice_id=invoice_id,
            invoice_line_id=line_id,
            allocated_amount=amt,
            currency=currency,
        )
        session.add(alloc)
        session.flush()
        session.commit()
        return json_response(
            201,
            {"allocationId": str(alloc.id)},
            event=event,
        )


def _export_csv(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        payments = (
            session.execute(
                select(CustomerPayment)
                .order_by(CustomerPayment.created_at.desc())
                .limit(5000)
            )
            .scalars()
            .all()
        )
        allocs = session.execute(select(PaymentAllocation).limit(10000)).scalars().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "export_version",
            "document_type",
            "document_id",
            "amount",
            "currency",
            "stripe_payment_intent_id",
            "stripe_refund_id",
            "enrollment_id",
            "created_at",
        ]
    )
    for p in payments:
        w.writerow(
            [
                "1",
                "payment",
                str(p.id),
                str(p.amount),
                p.currency,
                p.stripe_payment_intent_id or "",
                p.stripe_refund_id or "",
                str(p.enrollment_id) if p.enrollment_id else "",
                p.created_at.isoformat(),
            ]
        )
    for a in allocs:
        w.writerow(
            [
                "1",
                "allocation",
                str(a.id),
                str(a.allocated_amount),
                a.currency,
                "",
                "",
                "",
                a.created_at.isoformat(),
            ]
        )

    return json_response(
        200,
        {"csv": buf.getvalue()},
        event=event,
    )
