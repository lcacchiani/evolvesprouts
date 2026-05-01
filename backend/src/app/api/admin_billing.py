"""Admin customer billing (AR) API."""

from __future__ import annotations

import csv
import io
from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.admin_request import (
    encode_created_cursor,
    parse_body,
    parse_created_cursor,
    parse_limit,
    parse_uuid,
    query_param,
    request_id,
)
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import AuditService, set_audit_context
from app.db.engine import get_engine
from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models import Contact, Enrollment, Family, Organization
from app.db.models.family import FamilyMember
from app.db.models.organization import OrganizationMember
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
    finalize_receipt_pdf_upload,
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
        if method == "GET":
            return _list_invoices(event, user_sub=identity.user_sub, request_id=req)
        if method == "POST":
            return _create_invoice_draft(
                event, user_sub=identity.user_sub, request_id=req
            )

    if sub == "invoices" and len(parts) == 4:
        inv_id = parse_uuid(parts[3])
        if method == "GET":
            return _get_invoice(
                event, inv_id, user_sub=identity.user_sub, request_id=req
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


@contextmanager
def _session_with_audit(user_sub: str, request_id_val: str | None):
    """Open a session + transaction and set audit context inside the transaction."""
    with Session(get_engine()) as session:
        with session.begin():
            set_audit_context(session, user_id=user_sub, request_id=request_id_val)
            yield session


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


def _serialize_invoice_line(line: CustomerInvoiceLine) -> dict[str, Any]:
    return {
        "id": str(line.id),
        "invoiceId": str(line.invoice_id),
        "enrollmentId": str(line.enrollment_id),
        "lineOrder": line.line_order,
        "description": line.description,
        "quantity": str(line.quantity),
        "unitAmount": str(line.unit_amount),
        "lineTotal": str(line.line_total),
        "discountAmount": str(line.discount_amount)
        if line.discount_amount is not None
        else None,
        "taxRate": str(line.tax_rate) if line.tax_rate is not None else None,
        "taxAmount": str(line.tax_amount) if line.tax_amount is not None else None,
        "currency": line.currency,
        "createdAt": line.created_at.isoformat(),
        "updatedAt": line.updated_at.isoformat(),
    }


def _serialize_invoice_summary(
    inv: CustomerInvoice, *, line_count: int
) -> dict[str, Any]:
    return {
        "id": str(inv.id),
        "status": inv.status.value,
        "invoiceNumber": inv.invoice_number,
        "invoiceSequence": inv.invoice_sequence,
        "currency": inv.currency,
        "subtotal": str(inv.subtotal),
        "taxTotal": str(inv.tax_total),
        "total": str(inv.total),
        "billToKind": inv.bill_to_kind.value,
        "billToContactId": str(inv.bill_to_contact_id)
        if inv.bill_to_contact_id
        else None,
        "billToFamilyId": str(inv.bill_to_family_id) if inv.bill_to_family_id else None,
        "billToOrganizationId": str(inv.bill_to_organization_id)
        if inv.bill_to_organization_id
        else None,
        "billToDisplayName": inv.bill_to_display_name,
        "billToEmail": inv.bill_to_email,
        "issuedAt": inv.issued_at.isoformat() if inv.issued_at else None,
        "voidedAt": inv.voided_at.isoformat() if inv.voided_at else None,
        "issuedPdfSha256": inv.issued_pdf_sha256,
        "lineCount": line_count,
        "createdAt": inv.created_at.isoformat(),
        "updatedAt": inv.updated_at.isoformat(),
    }


def _serialize_invoice_detail(inv: CustomerInvoice) -> dict[str, Any]:
    lines = sorted(inv.lines, key=lambda ln: (ln.line_order, ln.id))
    return {
        **_serialize_invoice_summary(inv, line_count=len(lines)),
        "voidReason": inv.void_reason,
        "billToSnapshot": inv.bill_to_snapshot,
        "emailSentAt": inv.email_sent_at.isoformat() if inv.email_sent_at else None,
        "lines": [_serialize_invoice_line(ln) for ln in lines],
    }


def _parse_optional_invoice_status(raw: str | None) -> BillingInvoiceStatus | None:
    if raw is None or str(raw).strip() == "":
        return None
    key = str(raw).strip().lower()
    try:
        return BillingInvoiceStatus(key)
    except ValueError as exc:
        raise ValidationError(
            "status must be one of: draft, issued, void",
            field="status",
        ) from exc


def _list_invoices(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    limit = parse_limit(event, default=_DEFAULT_LIMIT, max_limit=100)
    status_filter = _parse_optional_invoice_status(query_param(event, "status"))
    currency_raw = query_param(event, "currency")
    currency = (
        str(currency_raw).strip().upper()[:3]
        if currency_raw and str(currency_raw).strip()
        else None
    )
    if currency is not None and len(currency) != 3:
        raise ValidationError("currency must be a 3-letter ISO code", field="currency")

    cursor_ts, cursor_id = parse_created_cursor(query_param(event, "cursor"))

    with _session_with_audit(user_sub, request_id) as session:
        stmt = select(CustomerInvoice)
        if status_filter is not None:
            stmt = stmt.where(CustomerInvoice.status == status_filter)
        if currency is not None:
            stmt = stmt.where(CustomerInvoice.currency == currency)
        if cursor_ts is not None and cursor_id is not None:
            stmt = stmt.where(
                or_(
                    CustomerInvoice.created_at < cursor_ts,
                    and_(
                        CustomerInvoice.created_at == cursor_ts,
                        CustomerInvoice.id < cursor_id,
                    ),
                )
            )
        stmt = stmt.order_by(
            CustomerInvoice.created_at.desc(), CustomerInvoice.id.desc()
        ).limit(limit + 1)
        rows = list(session.execute(stmt).scalars().all())
        has_more = len(rows) > limit
        page = rows[:limit]
        ids = [r.id for r in page]
        count_map: dict[UUID, int] = {}
        if ids:
            cnt_rows = session.execute(
                select(
                    CustomerInvoiceLine.invoice_id, func.count(CustomerInvoiceLine.id)
                )
                .where(CustomerInvoiceLine.invoice_id.in_(ids))
                .group_by(CustomerInvoiceLine.invoice_id)
            ).all()
            count_map = {row[0]: int(row[1]) for row in cnt_rows}

        items = [
            _serialize_invoice_summary(inv, line_count=count_map.get(inv.id, 0))
            for inv in page
        ]
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = encode_created_cursor(last.created_at, last.id)
        return json_response(
            200,
            {"items": items, "next_cursor": next_cursor},
            event=event,
        )


def _get_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        stmt = (
            select(CustomerInvoice)
            .where(CustomerInvoice.id == invoice_id)
            .options(selectinload(CustomerInvoice.lines))
        )
        inv = session.execute(stmt).scalar_one_or_none()
        if inv is None:
            raise NotFoundError("CustomerInvoice", str(invoice_id))
        return json_response(
            200,
            {"invoice": _serialize_invoice_detail(inv)},
            event=event,
        )


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
    return json_response(201, {"payment": payload}, event=event)


def _confirm_payment(
    event: Mapping[str, Any],
    payment_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event) if event.get("body") else {}
    receipt_id_for_upload: UUID | None = None
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
            rcpt = create_receipt_for_succeeded_inbound_payment(session, payment=p)
            receipt_id_for_upload = rcpt.id
        out = _serialize_payment(p)
    if receipt_id_for_upload is not None:
        try:
            with Session(get_engine()) as upload_session:
                finalize_receipt_pdf_upload(
                    upload_session, receipt_id=receipt_id_for_upload
                )
                upload_session.commit()
        except Exception:
            logger.exception(
                "Receipt PDF S3 finalize failed after payment confirm",
                extra={"receipt_id": str(receipt_id_for_upload)},
            )
    return json_response(200, {"payment": out}, event=event)


def _enrollment_merge_key(en: Enrollment) -> tuple[Any, ...]:
    bk = en.bill_to_kind or BillingBillToKind.CONTACT
    return (
        bk,
        en.bill_to_contact_id,
        en.bill_to_family_id,
        en.bill_to_organization_id,
    )


def _contact_display_name(c: Contact) -> str | None:
    return " ".join(x for x in [c.first_name, c.last_name] if x).strip() or None


def _resolve_bill_to_party_for_draft(
    session: Session, *, inv: CustomerInvoice, first: Enrollment
) -> None:
    """Set bill_to_email and bill_to_display_name for contact, family, or org."""
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        cid = inv.bill_to_contact_id or first.contact_id
        if cid:
            c = session.get(Contact, cid)
            if c and c.email:
                inv.bill_to_email = c.email
                inv.bill_to_display_name = _contact_display_name(c)
        return
    if inv.bill_to_kind == BillingBillToKind.FAMILY and inv.bill_to_family_id:
        fam = session.get(Family, inv.bill_to_family_id)
        if fam is None:
            return
        inv.bill_to_display_name = fam.family_name
        stmt = (
            select(Contact)
            .join(FamilyMember, FamilyMember.contact_id == Contact.id)
            .where(FamilyMember.family_id == inv.bill_to_family_id)
            .where(FamilyMember.is_primary_contact.is_(True))
            .limit(1)
        )
        primary = session.execute(stmt).scalar_one_or_none()
        if primary and primary.email:
            inv.bill_to_email = primary.email
        return
    if (
        inv.bill_to_kind == BillingBillToKind.ORGANIZATION
        and inv.bill_to_organization_id
    ):
        org = session.get(Organization, inv.bill_to_organization_id)
        if org is None:
            return
        inv.bill_to_display_name = org.name
        stmt = (
            select(Contact)
            .join(
                OrganizationMember,
                OrganizationMember.contact_id == Contact.id,
            )
            .where(OrganizationMember.organization_id == inv.bill_to_organization_id)
            .where(OrganizationMember.is_primary_contact.is_(True))
            .limit(1)
        )
        primary = session.execute(stmt).scalar_one_or_none()
        if primary and primary.email:
            inv.bill_to_email = primary.email


def _validate_bill_to_fk_for_issue(inv: CustomerInvoice) -> None:
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        if inv.bill_to_contact_id is None:
            raise ValidationError(
                "Invoice bill-to contact is required before issue",
                field="invoiceId",
            )
        if inv.bill_to_family_id is not None or inv.bill_to_organization_id is not None:
            raise ValidationError(
                "Invoice has inconsistent bill-to foreign keys",
                field="invoiceId",
            )
        return
    if inv.bill_to_kind == BillingBillToKind.FAMILY:
        if inv.bill_to_family_id is None:
            raise ValidationError(
                "Invoice bill-to family is required before issue",
                field="invoiceId",
            )
        if (
            inv.bill_to_contact_id is not None
            or inv.bill_to_organization_id is not None
        ):
            raise ValidationError(
                "Invoice has inconsistent bill-to foreign keys",
                field="invoiceId",
            )
        return
    if inv.bill_to_kind == BillingBillToKind.ORGANIZATION:
        if inv.bill_to_organization_id is None:
            raise ValidationError(
                "Invoice bill-to organization is required before issue",
                field="invoiceId",
            )
        if inv.bill_to_contact_id is not None or inv.bill_to_family_id is not None:
            raise ValidationError(
                "Invoice has inconsistent bill-to foreign keys",
                field="invoiceId",
            )


def _build_bill_to_snapshot(session: Session, inv: CustomerInvoice) -> dict[str, Any]:
    snap: dict[str, Any] = {
        "kind": inv.bill_to_kind.value,
        "display_name": inv.bill_to_display_name,
        "email": inv.bill_to_email,
        "snapshot_at": datetime.now(UTC).isoformat(),
    }
    if inv.bill_to_kind == BillingBillToKind.CONTACT and inv.bill_to_contact_id:
        c = session.get(Contact, inv.bill_to_contact_id)
        if c:
            snap["contact"] = {
                "id": str(c.id),
                "first_name": c.first_name,
                "last_name": c.last_name,
                "email": c.email,
            }
    elif inv.bill_to_kind == BillingBillToKind.FAMILY and inv.bill_to_family_id:
        fam = session.get(Family, inv.bill_to_family_id)
        if fam:
            snap["family"] = {"id": str(fam.id), "family_name": fam.family_name}
    elif (
        inv.bill_to_kind == BillingBillToKind.ORGANIZATION
        and inv.bill_to_organization_id
    ):
        org = session.get(Organization, inv.bill_to_organization_id)
        if org:
            snap["organization"] = {"id": str(org.id), "name": org.name}
    return snap


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

    overrides_raw = body.get("lineTotalsByEnrollmentId") or body.get(
        "line_totals_by_enrollment_id"
    )
    line_overrides: dict[UUID, Decimal] = {}
    if isinstance(overrides_raw, Mapping):
        for k, v in overrides_raw.items():
            try:
                eid_key = UUID(str(k))
                line_overrides[eid_key] = Decimal(str(v))
            except (ValueError, TypeError, InvalidOperation):
                raise ValidationError(
                    "lineTotalsByEnrollmentId must map enrollment UUID strings to amounts",
                    field="lineTotalsByEnrollmentId",
                ) from None

    with _session_with_audit(user_sub, request_id) as session:
        rows = list(
            session.execute(
                select(Enrollment)
                .where(Enrollment.id.in_(eids))
                .options(
                    joinedload(Enrollment.instance),
                    joinedload(Enrollment.contact),
                )
            )
            .unique()
            .scalars()
            .all()
        )
        by_id = {row.id: row for row in rows}
        missing = [eid for eid in eids if eid not in by_id]
        if missing:
            raise ValidationError(
                f"Enrollment not found: {missing[0]}",
                field="enrollmentIds",
            )
        enrollments = [by_id[eid] for eid in eids]

        for en in enrollments:
            ec = (en.currency or "HKD").upper()[:3]
            if ec != currency:
                raise ValidationError(
                    "All enrollments must match invoice currency",
                    field="currency",
                )

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
        _resolve_bill_to_party_for_draft(session, inv=inv, first=first)

        session.add(inv)
        session.flush()

        subtotal = Decimal("0")
        tax_total = Decimal("0")
        for order, en in enumerate(enrollments):
            title = ""
            if en.instance:
                title = (en.instance.title or "").strip()
            if en.id in line_overrides:
                line_total = line_overrides[en.id]
            else:
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

        _validate_bill_to_fk_for_issue(inv)
        inv.bill_to_snapshot = _build_bill_to_snapshot(session, inv)

        num, seq = next_invoice_number(session, currency=inv.currency)
        inv.invoice_number = num
        inv.invoice_sequence = seq
        inv.status = BillingInvoiceStatus.ISSUED
        inv.issued_at = datetime.now(UTC)
        session.flush()
        refresh_invoice_pdf(session, inv)

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
        if inv.status == BillingInvoiceStatus.VOID:
            raise ValidationError("Invoice is already void", field="invoiceId")
        prev = inv.status
        inv.status = BillingInvoiceStatus.VOID
        inv.voided_at = datetime.now(UTC)
        inv.void_reason = reason[:2000]
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_invoices",
            record_id=inv.id,
            action=(
                "VOID_FROM_DRAFT"
                if prev == BillingInvoiceStatus.DRAFT
                else "VOID_FROM_ISSUED"
            ),
            new_values={"reason": inv.void_reason},
        )
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
        return json_response(
            201,
            {"allocationId": str(alloc.id)},
            event=event,
        )


def _export_csv(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    raw_ver = (
        (
            query_param(event, "exportVersion")
            or query_param(event, "export_version")
            or "2"
        )
        .strip()
        .lower()
    )
    if raw_ver not in ("1", "2"):
        raise ValidationError("exportVersion must be 1 or 2", field="exportVersion")

    with _session_with_audit(user_sub, request_id) as session:
        if raw_ver == "1":
            payments = (
                session.execute(
                    select(CustomerPayment)
                    .order_by(CustomerPayment.created_at.desc())
                    .limit(5000)
                )
                .scalars()
                .all()
            )
            allocs = (
                session.execute(select(PaymentAllocation).limit(10000)).scalars().all()
            )
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
            return json_response(200, {"csv": buf.getvalue()}, event=event)

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
        invoices = (
            session.execute(
                select(CustomerInvoice)
                .order_by(CustomerInvoice.created_at.desc())
                .limit(5000)
            )
            .scalars()
            .all()
        )
        inv_ids = [i.id for i in invoices]
        lines_by_invoice: dict[UUID, list[CustomerInvoiceLine]] = {}
        if inv_ids:
            line_rows = (
                session.execute(
                    select(CustomerInvoiceLine)
                    .where(CustomerInvoiceLine.invoice_id.in_(inv_ids))
                    .order_by(
                        CustomerInvoiceLine.invoice_id,
                        CustomerInvoiceLine.line_order,
                    )
                )
                .scalars()
                .all()
            )
            for ln in line_rows:
                lines_by_invoice.setdefault(ln.invoice_id, []).append(ln)
        receipts = (
            session.execute(
                select(CustomerReceipt)
                .order_by(CustomerReceipt.created_at.desc())
                .limit(5000)
            )
            .scalars()
            .all()
        )

        def _snap_name(snap: Any) -> str:
            if not snap:
                return ""
            v = snap.get("display_name")
            return str(v) if v else ""

        def _payment_doc_type(p: CustomerPayment) -> str:
            if p.direction == BillingPaymentDirection.REFUND:
                return "refund"
            return "payment"

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "export_version",
                "document_type",
                "document_id",
                "parent_document_id",
                "amount",
                "currency",
                "payment_method",
                "bank_reference",
                "counterparty_name_snapshot",
                "tax_amount",
                "created_by",
                "stripe_payment_intent_id",
                "stripe_refund_id",
                "original_payment_id",
                "bill_to_kind",
                "bill_to_email",
                "bill_to_display_name",
                "invoice_number",
                "enrollment_id",
                "invoice_line_id",
                "created_at",
            ]
        )
        for p in payments:
            w.writerow(
                [
                    "2",
                    _payment_doc_type(p),
                    str(p.id),
                    str(p.original_payment_id) if p.original_payment_id else "",
                    str(p.amount),
                    p.currency,
                    p.method,
                    p.external_reference or "",
                    "",
                    "",
                    p.confirmed_by or "",
                    p.stripe_payment_intent_id or "",
                    p.stripe_refund_id or "",
                    str(p.original_payment_id) if p.original_payment_id else "",
                    "",
                    "",
                    "",
                    "",
                    str(p.enrollment_id) if p.enrollment_id else "",
                    "",
                    p.created_at.isoformat(),
                ]
            )
        for inv in invoices:
            snap = inv.bill_to_snapshot or {}
            w.writerow(
                [
                    "2",
                    "invoice",
                    str(inv.id),
                    "",
                    str(inv.total),
                    inv.currency,
                    "",
                    "",
                    _snap_name(snap if isinstance(snap, Mapping) else {}),
                    str(inv.tax_total),
                    "",
                    "",
                    "",
                    "",
                    inv.bill_to_kind.value,
                    inv.bill_to_email or "",
                    inv.bill_to_display_name or "",
                    inv.invoice_number or "",
                    "",
                    "",
                    inv.created_at.isoformat(),
                ]
            )
            for ln in lines_by_invoice.get(inv.id, []):
                w.writerow(
                    [
                        "2",
                        "invoice_line",
                        str(ln.id),
                        str(inv.id),
                        str(ln.line_total),
                        ln.currency,
                        "",
                        "",
                        (ln.description or "")[:200],
                        str(ln.tax_amount) if ln.tax_amount is not None else "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        inv.invoice_number or "",
                        str(ln.enrollment_id),
                        str(ln.id),
                        ln.created_at.isoformat(),
                    ]
                )
        for r in receipts:
            w.writerow(
                [
                    "2",
                    "receipt",
                    str(r.id),
                    str(r.customer_payment_id),
                    str(r.total_amount),
                    r.currency,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    r.receipt_number,
                    "",
                    "",
                    r.created_at.isoformat(),
                ]
            )
        for a in allocs:
            w.writerow(
                [
                    "2",
                    "allocation",
                    str(a.id),
                    str(a.invoice_id),
                    str(a.allocated_amount),
                    a.currency,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    str(a.invoice_id),
                    "",
                    str(a.invoice_line_id) if a.invoice_line_id else "",
                    a.created_at.isoformat(),
                ]
            )

    return json_response(200, {"csv": buf.getvalue()}, event=event)
