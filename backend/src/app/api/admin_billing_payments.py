"""Admin billing: customer payments."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.admin_billing_common import DEFAULT_BILLING_LIST_LIMIT, _session_with_audit
from app.api.admin_request import parse_body
from app.db.audit import AuditService
from app.db.engine import get_engine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models.enums import BillingPaymentDirection, BillingPaymentStatus
from app.exceptions import NotFoundError, ValidationError
from app.services.customer_billing import (
    create_receipt_for_succeeded_inbound_payment,
    finalize_receipt_pdf_upload,
    payment_unapplied_amount,
)
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


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
            .limit(DEFAULT_BILLING_LIST_LIMIT)
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
