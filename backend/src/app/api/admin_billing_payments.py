"""Admin billing: customer payments."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.api.admin_billing_common import DEFAULT_BILLING_LIST_LIMIT, _session_with_audit
from app.api.admin_request import parse_body, query_param
from app.db.audit import AuditService
from app.db.engine import get_engine
from app.db.models.customer_invoice import CustomerInvoice
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models.enrollment import Enrollment
from app.db.models.enums import (
    BillingPaymentDirection,
    BillingPaymentStatus,
    EnrollmentStatus,
)
from app.db.models.payment_allocation import PaymentAllocation
from app.exceptions import NotFoundError, ValidationError
from app.services.customer_billing import (
    create_receipt_for_succeeded_inbound_payment,
    finalize_receipt_pdf_upload,
    payment_unapplied_amount,
)
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _payment_allocation_invoice_refs(
    session: Session, payment_id: UUID
) -> list[dict[str, str | None]]:
    """Distinct invoices this payment is allocated to (for admin UI pickers)."""
    inv_ids = list(
        session.execute(
            select(PaymentAllocation.invoice_id)
            .where(PaymentAllocation.payment_id == payment_id)
            .distinct()
        )
        .scalars()
        .all()
    )
    if not inv_ids:
        return []
    rows = session.execute(
        select(
            CustomerInvoice.id,
            CustomerInvoice.invoice_number,
            CustomerInvoice.created_at,
        ).where(CustomerInvoice.id.in_(inv_ids))
    ).all()
    by_id = {r[0]: (r[1], r[2]) for r in rows}
    ordered = sorted(
        inv_ids,
        key=lambda i: (
            by_id.get(i, (None, None))[1] or datetime.min.replace(tzinfo=UTC)
        ),
        reverse=True,
    )
    out: list[dict[str, str | None]] = []
    for iid in ordered:
        num, _ts = by_id.get(iid, (None, None))
        out.append(
            {
                "invoiceId": str(iid),
                "invoiceNumber": str(num).strip() if num else None,
            }
        )
    return out


def _serialize_payment(
    p: CustomerPayment, *, orphan_payment_deletable: bool
) -> dict[str, Any]:
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
        "orphanPaymentDeletable": orphan_payment_deletable,
    }


def _pending_or_free_payment(p: CustomerPayment) -> bool:
    if p.status == BillingPaymentStatus.PENDING:
        return True
    if p.method.strip().lower() == "free":
        return True
    if p.amount == Decimal("0"):
        return True
    return False


def _enrollment_unlinked_or_cancelled(
    enrollment_id: UUID | None,
    enrollment_status_by_id: dict[UUID, EnrollmentStatus],
) -> bool:
    if enrollment_id is None:
        return True
    status = enrollment_status_by_id.get(enrollment_id)
    if status is None:
        return True
    return status == EnrollmentStatus.CANCELLED


def _batch_orphan_payment_deletable(
    session: Session, rows: list[CustomerPayment]
) -> dict[UUID, bool]:
    """Server-side eligibility for DELETE (matches single-payment validation)."""
    if not rows:
        return {}
    pay_ids = [p.id for p in rows]
    allocation_pay_ids = {
        row[0]
        for row in session.execute(
            select(PaymentAllocation.payment_id).where(
                PaymentAllocation.payment_id.in_(pay_ids)
            )
        ).all()
    }
    receipt_pay_ids = {
        row[0]
        for row in session.execute(
            select(CustomerReceipt.customer_payment_id).where(
                CustomerReceipt.customer_payment_id.in_(pay_ids)
            )
        ).all()
    }
    refund_parent_ids: set[UUID] = set()
    for (orig_id,) in session.execute(
        select(CustomerPayment.original_payment_id).where(
            CustomerPayment.original_payment_id.in_(pay_ids),
            CustomerPayment.direction == BillingPaymentDirection.REFUND,
        )
    ).all():
        if orig_id is not None:
            refund_parent_ids.add(orig_id)
    enrollment_ids = [p.enrollment_id for p in rows if p.enrollment_id is not None]
    enrollment_status_by_id: dict[UUID, EnrollmentStatus] = {}
    if enrollment_ids:
        for eid, st in session.execute(
            select(Enrollment.id, Enrollment.status).where(
                Enrollment.id.in_(enrollment_ids)
            )
        ):
            enrollment_status_by_id[eid] = st

    out: dict[UUID, bool] = {}
    for p in rows:
        ok = (
            p.direction == BillingPaymentDirection.INBOUND
            and _pending_or_free_payment(p)
            and _enrollment_unlinked_or_cancelled(
                p.enrollment_id, enrollment_status_by_id
            )
            and p.id not in allocation_pay_ids
            and p.id not in receipt_pay_ids
            and p.id not in refund_parent_ids
        )
        out[p.id] = ok
    return out


def _validate_orphan_delete(session: Session, p: CustomerPayment) -> None:
    if p.direction != BillingPaymentDirection.INBOUND:
        raise ValidationError("Only inbound payments can be deleted", field="paymentId")
    if not _pending_or_free_payment(p):
        raise ValidationError(
            "Only pending inbound or free ($0) payments can be deleted",
            field="paymentId",
        )
    if p.enrollment_id is not None:
        en = session.get(Enrollment, p.enrollment_id)
        if en is not None and en.status != EnrollmentStatus.CANCELLED:
            raise ValidationError(
                "Payment is still linked to an enrollment that is not cancelled",
                field="enrollmentId",
            )
    has_alloc = session.execute(
        select(
            exists().where(PaymentAllocation.payment_id == p.id),
        )
    ).scalar_one()
    if has_alloc:
        raise ValidationError(
            "Payment has invoice allocations and cannot be deleted",
            field="paymentId",
        )
    has_rcpt = session.execute(
        select(exists().where(CustomerReceipt.customer_payment_id == p.id))
    ).scalar_one()
    if has_rcpt:
        raise ValidationError(
            "Payment has a receipt row and cannot be deleted", field="paymentId"
        )
    has_refund = session.execute(
        select(
            exists().where(
                CustomerPayment.original_payment_id == p.id,
                CustomerPayment.direction == BillingPaymentDirection.REFUND,
            )
        )
    ).scalar_one()
    if has_refund:
        raise ValidationError(
            "Payment has linked refund rows and cannot be deleted",
            field="paymentId",
        )


def _delete_payment(
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
        _validate_orphan_delete(session, p)
        old_values = p.to_audit_dict()
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_payments",
            record_id=payment_id,
            action="ORPHAN_INBOUND_PAYMENT_DELETED",
            old_values=old_values,
        )
        session.delete(p)
        session.flush()
    return json_response(204, {}, event=event)


def _list_payments(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    invoice_raw = query_param(event, "invoice_id") or query_param(event, "invoiceId")
    inv_filter: UUID | None = None
    if invoice_raw and str(invoice_raw).strip():
        try:
            inv_filter = UUID(str(invoice_raw).strip())
        except (ValueError, TypeError) as exc:
            raise ValidationError(
                "invoice_id must be a UUID", field="invoice_id"
            ) from exc

    with _session_with_audit(user_sub, request_id) as session:
        stmt = select(CustomerPayment).order_by(CustomerPayment.created_at.desc())
        if inv_filter is not None:
            subq = (
                select(PaymentAllocation.payment_id)
                .where(PaymentAllocation.invoice_id == inv_filter)
                .distinct()
                .subquery()
            )
            stmt = (
                select(CustomerPayment)
                .join(subq, CustomerPayment.id == subq.c.payment_id)
                .order_by(CustomerPayment.created_at.desc())
            )
        stmt = stmt.limit(DEFAULT_BILLING_LIST_LIMIT)
        rows = list(session.execute(stmt).scalars().all())
        deletable_by_id = _batch_orphan_payment_deletable(session, rows)
        return json_response(
            200,
            {
                "items": [
                    _serialize_payment(
                        p, orphan_payment_deletable=deletable_by_id.get(p.id, False)
                    )
                    for p in rows
                ]
            },
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
        allocation_invoices = _payment_allocation_invoice_refs(session, payment_id)
        deletable = _batch_orphan_payment_deletable(session, [p]).get(p.id, False)
        return json_response(
            200,
            {
                **_serialize_payment(p, orphan_payment_deletable=deletable),
                "unappliedAmount": unapplied,
                "allocationInvoices": allocation_invoices,
            },
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


def _normalize_manual_payment_method(raw: str) -> str:
    """Map admin-entered payment method strings to stored billing method values."""
    pm = (raw or "").strip().lower()
    if pm in ("free", ""):
        return "free"
    if "apple" in pm and "pay" in pm:
        return "stripe_card"
    if "stripe" in pm or pm in ("card", "credit_card", "debit_card"):
        return "stripe_card"
    if pm in ("fps", "fps_qr", "fps-qr"):
        return "fps"
    if "bank" in pm or pm in ("wire", "ach", "transfer"):
        return "bank_transfer"
    if pm == "adjustment":
        return "adjustment"
    if pm in ("cash", "cheque", "check"):
        return pm
    return pm.replace(" ", "_")[:64] if pm else "unknown"


def _contact_id_for_enrollment_payment(en: Enrollment) -> UUID | None:
    """Prefer explicit bill-to contact, then enrollment contact."""
    if en.bill_to_contact_id is not None:
        return en.bill_to_contact_id
    return en.contact_id


def _create_payment(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    body = parse_body(event)
    direction = str(body.get("direction") or "").strip().lower()
    if direction == "refund":
        return _create_refund_payment(
            event, body, user_sub=user_sub, request_id=request_id
        )
    if direction == "inbound":
        return _create_manual_inbound_payment(
            event, body, user_sub=user_sub, request_id=request_id
        )
    raise ValidationError(
        "direction must be refund (refund row) or inbound (manual customer payment)",
        field="direction",
    )


def _create_manual_inbound_payment(
    event: Mapping[str, Any],
    body: Mapping[str, Any],
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    raw_eid = body.get("enrollmentId") or body.get("enrollment_id")
    if not raw_eid:
        raise ValidationError(
            "enrollmentId is required for inbound payment creation",
            field="enrollmentId",
        )
    try:
        enrollment_id = UUID(str(raw_eid).strip())
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            "enrollmentId must be a UUID", field="enrollmentId"
        ) from exc

    try:
        amount = Decimal(str(body.get("amount")))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(
            "amount must be a decimal number", field="amount"
        ) from exc
    if amount < 0:
        raise ValidationError("amount must be zero or positive", field="amount")

    currency = str(body.get("currency") or "").upper()[:3]
    if len(currency) != 3:
        raise ValidationError("currency is required", field="currency")

    method_raw = str(body.get("method") or "").strip()
    if method_raw == "":
        raise ValidationError("method is required", field="method")
    method = _normalize_manual_payment_method(method_raw)
    if len(method) > 64:
        raise ValidationError("method is too long", field="method")

    status_raw = str(body.get("status") or "pending").strip().lower()
    if status_raw not in ("pending", "succeeded"):
        raise ValidationError("status must be pending or succeeded", field="status")

    ext_ref = (
        str(
            body.get("externalReference") or body.get("external_reference") or ""
        ).strip()
        or None
    )

    is_free_zero = amount == Decimal("0") or method == "free"
    if is_free_zero:
        method = "free"
        status_raw = "succeeded"

    receipt_id_for_upload: UUID | None = None
    with _session_with_audit(user_sub, request_id) as session:
        en = session.get(Enrollment, enrollment_id)
        if en is None:
            raise NotFoundError("Enrollment", str(enrollment_id))
        if en.status == EnrollmentStatus.CANCELLED:
            raise ValidationError(
                "Cannot record a payment for a cancelled enrollment",
                field="enrollmentId",
            )
        contact_id = _contact_id_for_enrollment_payment(en)
        if contact_id is None:
            raise ValidationError(
                "Enrollment must have a contact or bill-to contact for payment recording",
                field="enrollmentId",
            )

        if status_raw == "succeeded":
            pay_status = BillingPaymentStatus.SUCCEEDED
            succeeded_at = datetime.now(UTC)
            confirmed_by = user_sub
        else:
            pay_status = BillingPaymentStatus.PENDING
            succeeded_at = None
            confirmed_by = None

        pay = CustomerPayment(
            direction=BillingPaymentDirection.INBOUND,
            status=pay_status,
            method=method,
            amount=amount,
            currency=currency,
            enrollment_id=enrollment_id,
            contact_id=contact_id,
            external_reference=ext_ref,
            succeeded_at=succeeded_at,
            confirmed_by=confirmed_by,
        )
        session.add(pay)
        session.flush()
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_payments",
            record_id=pay.id,
            action="MANUAL_INBOUND_PAYMENT_CREATED",
            new_values={
                "enrollment_id": str(enrollment_id),
                "amount": str(amount),
                "currency": currency,
                "status": pay_status.value,
                "method": method,
            },
        )
        if pay_status == BillingPaymentStatus.SUCCEEDED:
            existing_receipt = session.execute(
                select(CustomerReceipt).where(
                    CustomerReceipt.customer_payment_id == pay.id
                )
            ).scalar_one_or_none()
            if existing_receipt is None:
                rcpt = create_receipt_for_succeeded_inbound_payment(
                    session, payment=pay
                )
                receipt_id_for_upload = rcpt.id
        deletable = _batch_orphan_payment_deletable(session, [pay]).get(pay.id, False)
        payload = _serialize_payment(pay, orphan_payment_deletable=deletable)
    if receipt_id_for_upload is not None:
        try:
            with Session(get_engine()) as upload_session:
                finalize_receipt_pdf_upload(
                    upload_session, receipt_id=receipt_id_for_upload
                )
                upload_session.commit()
        except Exception:
            logger.exception(
                "Receipt PDF S3 finalize failed after manual inbound payment create",
                extra={"receipt_id": str(receipt_id_for_upload)},
            )
    return json_response(201, {"payment": payload}, event=event)


def _create_refund_payment(
    event: Mapping[str, Any],
    body: Mapping[str, Any],
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    oid = body.get("originalPaymentId") or body.get("original_payment_id")
    if not oid:
        raise ValidationError(
            "originalPaymentId is required", field="originalPaymentId"
        )
    try:
        orig_id = UUID(str(oid))
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            "originalPaymentId must be a UUID", field="originalPaymentId"
        ) from exc
    try:
        amount = Decimal(str(body.get("amount")))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(
            "amount must be a decimal number", field="amount"
        ) from exc
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
        payload = _serialize_payment(refund, orphan_payment_deletable=False)
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
        deletable = _batch_orphan_payment_deletable(session, [p]).get(p.id, False)
        out = _serialize_payment(p, orphan_payment_deletable=deletable)
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
