"""Admin billing: create customer payment rows (manual inbound + refunds)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_billing_common import (
    _session_with_audit,
    effective_enrollment_bill_to_kind,
)
from app.api.admin_billing_payments import _serialize_payment_for_response
from app.db.audit import AuditService
from app.db.engine import get_engine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models.enrollment import Enrollment
from app.db.models.enums import (
    BillingBillToKind,
    BillingPaymentDirection,
    BillingPaymentStatus,
    EnrollmentStatus,
)
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.services.customer_billing import (
    create_receipt_for_succeeded_inbound_payment,
    finalize_receipt_pdf_upload,
)
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def normalize_manual_payment_method(raw: str) -> str:
    """Map admin-entered payment method strings to canonical billing method values."""
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
    if pm in ("cash",):
        return "cash"
    if pm in ("cheque", "check"):
        return "cheque"
    raise ValidationError(
        "method must be one of: free, stripe_card, fps, bank_transfer, adjustment, cash, cheque "
        "(or common aliases such as card, wire, transfer, check)",
        field="method",
    )


def contact_id_for_enrollment_payment(
    en: Enrollment, *, bill_kind: BillingBillToKind | None = None
) -> UUID | None:
    """Bill-to contact for contact-billed enrollments; None for family/org (attribution via enrollment_id)."""
    bk = bill_kind if bill_kind is not None else effective_enrollment_bill_to_kind(en)
    if bk in (BillingBillToKind.FAMILY, BillingBillToKind.ORGANIZATION):
        return None
    if en.bill_to_contact_id is not None:
        return en.bill_to_contact_id
    return en.contact_id


def _enrollment_billing_currency(en: Enrollment) -> str:
    cur = (en.currency or "").strip().upper()
    if len(cur) == 3:
        return cur
    raise ValidationError(
        "Enrollment has no billing currency; set currency on the enrollment before recording a payment.",
        field="enrollmentId",
    )


def create_manual_inbound_payment(
    event: Mapping[str, Any],
    body: Mapping[str, Any],
    *,
    user_sub: str,
    request_id: str | None,
    batch_orphan_payment_deletable: Callable[
        [Session, list[CustomerPayment]], dict[UUID, bool]
    ],
) -> dict[str, Any]:
    """Create an inbound customer payment linked to an enrollment (admin manual entry)."""
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
    method = normalize_manual_payment_method(method_raw)

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
        effective_status = "succeeded"
    else:
        effective_status = status_raw

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
        expected_currency = _enrollment_billing_currency(en)
        if currency != expected_currency:
            raise ValidationError(
                f"currency must match the enrollment billing currency ({expected_currency})",
                field="currency",
            )

        bill_kind = effective_enrollment_bill_to_kind(en)
        contact_id = contact_id_for_enrollment_payment(en, bill_kind=bill_kind)
        if contact_id is None and bill_kind == BillingBillToKind.CONTACT:
            raise ValidationError(
                "Enrollment must have a contact or bill-to contact for payment recording",
                field="enrollmentId",
            )

        if effective_status == "succeeded":
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
        try:
            session.flush()
        except IntegrityError as exc:
            err_txt = str(exc.orig) if exc.orig is not None else str(exc)
            if "uq_cp_enrollment_external_ref" in err_txt:
                raise ConflictError(
                    "duplicate_enrollment_payment_reference",
                    field="externalReference",
                    enrollmentId=str(enrollment_id),
                ) from exc
            raise

        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit_new: dict[str, Any] = {
            "enrollment_id": str(enrollment_id),
            "amount": str(amount),
            "currency": currency,
            "status": pay_status.value,
            "method": method,
            "external_reference": ext_ref,
            "contact_id": str(contact_id) if contact_id else None,
        }
        if succeeded_at is not None:
            audit_new["succeeded_at"] = succeeded_at.isoformat()
        audit.log_custom(
            table_name="customer_payments",
            record_id=pay.id,
            action="MANUAL_INBOUND_PAYMENT_CREATED",
            new_values=audit_new,
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
        deletable = batch_orphan_payment_deletable(session, [pay]).get(pay.id, False)
        payload = _serialize_payment_for_response(
            session, pay, orphan_payment_deletable=deletable
        )
    if receipt_id_for_upload is not None:
        # M5 tech debt: post-commit finalize uses a fresh Session and cannot see the in-memory
        # _pending_receipt_pdf_bytes on the receipt row; render_receipt_pdf runs again (same as confirm).
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


def create_refund_payment(
    event: Mapping[str, Any],
    body: Mapping[str, Any],
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    """Create an outbound refund customer payment row."""
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

    stripe_refund_id = str(body.get("stripeRefundId") or "").strip() or None
    method_stored = str(body.get("method") or "refund")[:64]

    with _session_with_audit(user_sub, request_id) as session:
        orig = session.get(CustomerPayment, orig_id)
        if orig is None:
            raise NotFoundError("CustomerPayment", str(orig_id))
        if orig.currency != currency:
            raise ValidationError(
                "Refund currency must match original payment currency",
                field="currency",
            )
        succeeded_at = datetime.now(UTC)
        refund = CustomerPayment(
            direction=BillingPaymentDirection.REFUND,
            status=BillingPaymentStatus.SUCCEEDED,
            method=method_stored,
            amount=amount,
            currency=currency,
            original_payment_id=orig_id,
            stripe_refund_id=stripe_refund_id,
            succeeded_at=succeeded_at,
            confirmed_by=user_sub,
        )
        session.add(refund)
        session.flush()
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_payments",
            record_id=refund.id,
            action="REFUND_CREATED",
            new_values={
                "original_payment_id": str(orig_id),
                "amount": str(amount),
                "currency": currency,
                "method": method_stored,
                "stripe_refund_id": stripe_refund_id,
                "contact_id": None,
                "external_reference": None,
                "succeeded_at": succeeded_at.isoformat(),
            },
        )
        payload = _serialize_payment_for_response(
            session, refund, orphan_payment_deletable=False
        )
    return json_response(201, {"payment": payload}, event=event)
