"""Customer billing (AR): PDF generation, S3, receipts, reservation capture."""

from __future__ import annotations

import hashlib
import io
import os
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models.enums import (
    BillingPaymentDirection,
    BillingPaymentStatus,
)
from app.db.models.payment_allocation import DocumentCounter, PaymentAllocation
from app.services.aws_clients import get_s3_client
from app.services.email import send_mime_email_with_optional_attachments
from app.utils.logging import get_logger

logger = get_logger(__name__)

PDF_TEMPLATE_VERSION = "billing-v1"
_SCOPE_DEFAULT = "default"
_DOC_INVOICE = "invoice"
_DOC_RECEIPT = "receipt"


def _confirmation_from_address() -> str:
    return os.getenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "").strip()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def render_invoice_pdf(
    *,
    invoice: CustomerInvoice,
    lines: list[CustomerInvoiceLine],
) -> bytes:
    """Render a minimal AR invoice PDF (immutable snapshot)."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, "Invoice")
    y -= 24
    c.setFont("Helvetica", 10)
    if invoice.invoice_number:
        c.drawString(50, y, f"Number: {invoice.invoice_number}")
        y -= 14
    if invoice.issued_at:
        c.drawString(50, y, f"Issued: {invoice.issued_at.isoformat()}")
        y -= 14
    c.drawString(50, y, f"Currency: {invoice.currency}")
    y -= 14
    if invoice.bill_to_display_name:
        c.drawString(50, y, f"Bill to: {invoice.bill_to_display_name}")
        y -= 14
    if invoice.bill_to_email:
        c.drawString(50, y, f"Email: {invoice.bill_to_email}")
        y -= 20
    y -= 10
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "Description")
    c.drawString(320, y, "Amount")
    y -= 16
    c.setFont("Helvetica", 9)
    for line in sorted(lines, key=lambda x: x.line_order):
        desc = (line.description or "")[:80]
        c.drawString(50, y, desc)
        c.drawRightString(540, y, f"{line.line_total} {line.currency}")
        y -= 14
        if y < 80:
            c.showPage()
            y = height - 50
    y -= 10
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "Total")
    c.drawRightString(540, y, f"{invoice.total} {invoice.currency}")
    c.showPage()
    c.save()
    return buf.getvalue()


def render_receipt_pdf(
    *,
    receipt: CustomerReceipt,
    payment: CustomerPayment,
    allocation_invoice_numbers: list[tuple[str, Decimal]],
) -> bytes:
    """Render receipt PDF (one per succeeded inbound payment)."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    height = A4[1]
    y = height - 50
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, "Payment receipt")
    y -= 24
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Receipt: {receipt.receipt_number}")
    y -= 14
    c.drawString(50, y, f"Amount: {receipt.total_amount} {receipt.currency}")
    y -= 14
    c.drawString(50, y, f"Method: {payment.method}")
    y -= 14
    if payment.stripe_payment_intent_id:
        c.drawString(50, y, f"Stripe PI: {payment.stripe_payment_intent_id}")
        y -= 14
    if allocation_invoice_numbers:
        y -= 8
        c.drawString(50, y, "Applied to invoices:")
        y -= 14
        for inv_no, amt in allocation_invoice_numbers:
            c.drawString(60, y, f"{inv_no}: {amt} {receipt.currency}")
            y -= 12
    c.showPage()
    c.save()
    return buf.getvalue()


def store_pdf_in_assets_bucket(*, s3_key: str, body: bytes, content_type: str) -> None:
    bucket = os.getenv("ASSETS_BUCKET_NAME", "").strip()
    if not bucket:
        logger.warning("ASSETS_BUCKET_NAME not set; skipping PDF upload")
        return
    get_s3_client().put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=body,
        ContentType=content_type,
    )


def next_invoice_number(session: Session, *, currency: str) -> tuple[str, int]:
    """Atomically allocate next invoice number (counter per currency scope + year)."""
    now = datetime.now(UTC)
    year = now.year
    scope_key = f"inv-{currency.upper()}"
    session.execute(
        text(
            """
            INSERT INTO document_counters (document_type, scope_key, year, last_number)
            VALUES (:dt, :sk, :yr, 0)
            ON CONFLICT (document_type, scope_key, year) DO NOTHING
            """
        ),
        {"dt": _DOC_INVOICE, "sk": scope_key, "yr": year},
    )
    row = session.execute(
        select(DocumentCounter)
        .where(DocumentCounter.document_type == _DOC_INVOICE)
        .where(DocumentCounter.scope_key == scope_key)
        .where(DocumentCounter.year == year)
        .with_for_update()
    ).scalar_one()
    row.last_number += 1
    seq = row.last_number
    inv_num = f"INV-{year}-{seq:06d}-{currency.upper()}"
    session.flush()
    return inv_num, seq


def next_receipt_number(session: Session, *, currency: str) -> tuple[str, int]:
    now = datetime.now(UTC)
    year = now.year
    scope_key = f"rcp-{currency.upper()}"
    session.execute(
        text(
            """
            INSERT INTO document_counters (document_type, scope_key, year, last_number)
            VALUES (:dt, :sk, :yr, 0)
            ON CONFLICT (document_type, scope_key, year) DO NOTHING
            """
        ),
        {"dt": _DOC_RECEIPT, "sk": scope_key, "yr": year},
    )
    row = session.execute(
        select(DocumentCounter)
        .where(DocumentCounter.document_type == _DOC_RECEIPT)
        .where(DocumentCounter.scope_key == scope_key)
        .where(DocumentCounter.year == year)
        .with_for_update()
    ).scalar_one()
    row.last_number += 1
    seq = row.last_number
    rnum = f"RCP-{year}-{seq:06d}-{currency.upper()}"
    session.flush()
    return rnum, seq


def allocation_invoice_labels_for_payment(
    session: Session, payment_id: UUID
) -> list[tuple[str, Decimal]]:
    rows = session.execute(
        select(CustomerInvoice.invoice_number, PaymentAllocation.allocated_amount)
        .join(
            CustomerInvoice,
            CustomerInvoice.id == PaymentAllocation.invoice_id,
        )
        .where(PaymentAllocation.payment_id == payment_id)
        .where(CustomerInvoice.invoice_number.isnot(None))
    ).all()
    out: list[tuple[str, Decimal]] = []
    for inv_num, amt in rows:
        if inv_num and amt is not None:
            out.append((str(inv_num), Decimal(str(amt))))
    return out


def create_receipt_for_succeeded_inbound_payment(
    session: Session,
    *,
    payment: CustomerPayment,
) -> CustomerReceipt:
    """Create receipt row, PDF bytes, and SHA-256 inside the DB transaction.

    Does **not** upload to S3 (defer to :func:`finalize_receipt_pdf_upload` after
    ``commit``) so S3 failures do not roll back payment confirmation.
    """
    if payment.direction != BillingPaymentDirection.INBOUND:
        raise ValueError("Receipt only for inbound payments")
    if payment.status != BillingPaymentStatus.SUCCEEDED:
        raise ValueError("Receipt requires succeeded payment")
    existing = session.execute(
        select(CustomerReceipt).where(CustomerReceipt.customer_payment_id == payment.id)
    ).scalar_one_or_none()
    if existing:
        return existing

    rnum, seq = next_receipt_number(session, currency=payment.currency)
    labels = allocation_invoice_labels_for_payment(session, payment.id)
    receipt = CustomerReceipt(
        customer_payment_id=payment.id,
        receipt_number=rnum,
        receipt_sequence=seq,
        currency=payment.currency,
        total_amount=payment.amount,
        pdf_template_version=PDF_TEMPLATE_VERSION,
    )
    session.add(receipt)
    session.flush()

    pdf_bytes = render_receipt_pdf(
        receipt=receipt,
        payment=payment,
        allocation_invoice_numbers=labels,
    )
    digest = _sha256_bytes(pdf_bytes)
    key = f"billing/receipts/{receipt.id}.pdf"
    receipt.issued_pdf_sha256 = digest
    session.flush()
    # Stash for post-commit upload (not a mapped column)
    setattr(receipt, "_pending_receipt_pdf_bytes", pdf_bytes)
    setattr(receipt, "_pending_receipt_s3_key", key)
    return receipt


def finalize_receipt_pdf_upload(session: Session, *, receipt_id: UUID) -> None:
    """Upload receipt PDF to S3 and set ``issued_pdf_s3_key`` (call after main commit)."""
    receipt = session.get(CustomerReceipt, receipt_id)
    if receipt is None or receipt.issued_pdf_s3_key:
        return
    payment = session.get(CustomerPayment, receipt.customer_payment_id)
    if payment is None:
        return
    pdf_bytes = getattr(receipt, "_pending_receipt_pdf_bytes", None)
    key = (
        getattr(receipt, "_pending_receipt_s3_key", None)
        or f"billing/receipts/{receipt.id}.pdf"
    )
    if pdf_bytes is None:
        labels = allocation_invoice_labels_for_payment(session, payment.id)
        pdf_bytes = render_receipt_pdf(
            receipt=receipt,
            payment=payment,
            allocation_invoice_numbers=labels,
        )
    try:
        store_pdf_in_assets_bucket(
            s3_key=key,
            body=pdf_bytes,
            content_type="application/pdf",
        )
    except Exception:
        logger.exception(
            "Receipt S3 upload failed after commit",
            extra={"receipt_id": str(receipt_id), "s3_key": key},
        )
        return
    receipt.issued_pdf_s3_key = key
    session.flush()


def send_receipt_email(session: Session, *, receipt_id: UUID, to_email: str) -> None:
    """Email receipt PDF to customer (best-effort)."""
    receipt = session.get(CustomerReceipt, receipt_id)
    if receipt is None or not receipt.issued_pdf_s3_key:
        return
    payment = session.get(CustomerPayment, receipt.customer_payment_id)
    if payment is None:
        return
    bucket = os.getenv("ASSETS_BUCKET_NAME", "").strip()
    if not bucket:
        logger.warning("ASSETS_BUCKET_NAME missing; cannot attach receipt PDF")
        return
    obj = get_s3_client().get_object(Bucket=bucket, Key=receipt.issued_pdf_s3_key)
    pdf_bytes = obj["Body"].read()
    src = _confirmation_from_address()
    if not src:
        logger.warning("CONFIRMATION_EMAIL_FROM_ADDRESS missing; skip receipt email")
        return
    subject = f"Receipt {receipt.receipt_number}"
    body_text = f"Thank you. Please find your payment receipt {receipt.receipt_number} attached."
    body_html = f"<p>{body_text}</p>"
    send_mime_email_with_optional_attachments(
        source=src,
        to_addresses=[to_email],
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        attachments=[
            (
                f"receipt-{receipt.receipt_number}.pdf",
                "application/pdf",
                pdf_bytes,
            )
        ],
    )
    # SES message id not captured by send_raw_email wrapper; leave ses_message_id null
    receipt.email_sent_at = datetime.now(UTC)
    session.flush()


def _canonical_reservation_payment_method(raw: str) -> str:
    """Map client payment method strings to canonical billing method values."""
    pm = (raw or "").strip().lower()
    if pm in ("free", ""):
        return "free"
    if "apple" in pm and "pay" in pm:
        return "stripe_card"
    if "stripe" in pm or "card" in pm:
        return "stripe_card"
    if pm in ("fps", "fps_qr", "fps-qr"):
        return "fps"
    if "bank" in pm or pm in ("wire", "ach", "transfer"):
        return "bank_transfer"
    if pm == "adjustment":
        return "adjustment"
    return pm.replace(" ", "_")[:64] if pm else "unknown"


def record_reservation_customer_payment(
    session: Session,
    *,
    enrollment_id: UUID,
    contact_id: UUID,
    currency: str,
    total_amount: Decimal,
    payment_method: str,
    stripe_payment_intent_id: str | None,
    stripe_currency: str | None,
) -> tuple[CustomerPayment | None, UUID | None]:
    """Insert customer_payment for a new enrollment.

    Receipts are not created at booking time; staff create them after invoice
    reconciliation via admin confirm or equivalent succeeded paths.
    """
    pm_lower = (payment_method or "").strip().lower()
    is_free = pm_lower == "free" or total_amount == Decimal("0")
    expects_stripe = "stripe" in pm_lower or "apple pay" in pm_lower
    canonical_method = _canonical_reservation_payment_method(payment_method)

    pay_currency = (stripe_currency or currency or "HKD").upper()[:3]

    if expects_stripe and stripe_payment_intent_id:
        existing_pi = session.execute(
            select(CustomerPayment).where(
                CustomerPayment.stripe_payment_intent_id == stripe_payment_intent_id
            )
        ).scalar_one_or_none()
        if existing_pi is not None:
            return existing_pi, None
        pay = CustomerPayment(
            direction=BillingPaymentDirection.INBOUND,
            status=BillingPaymentStatus.SUCCEEDED,
            method="stripe_card",
            amount=total_amount,
            currency=pay_currency,
            stripe_payment_intent_id=stripe_payment_intent_id,
            succeeded_at=datetime.now(UTC),
            enrollment_id=enrollment_id,
            contact_id=contact_id,
        )
    elif is_free:
        pay = CustomerPayment(
            direction=BillingPaymentDirection.INBOUND,
            status=BillingPaymentStatus.SUCCEEDED,
            method="free",
            amount=Decimal("0"),
            currency=pay_currency,
            succeeded_at=datetime.now(UTC),
            enrollment_id=enrollment_id,
            contact_id=contact_id,
        )
    else:
        pay = CustomerPayment(
            direction=BillingPaymentDirection.INBOUND,
            status=BillingPaymentStatus.PENDING,
            method=canonical_method,
            amount=total_amount,
            currency=pay_currency,
            enrollment_id=enrollment_id,
            contact_id=contact_id,
        )
    try:
        with session.begin_nested():
            session.add(pay)
            session.flush()
    except IntegrityError:
        if expects_stripe and stripe_payment_intent_id:
            dup = session.execute(
                select(CustomerPayment).where(
                    CustomerPayment.stripe_payment_intent_id == stripe_payment_intent_id
                )
            ).scalar_one_or_none()
            if dup is not None:
                return dup, None
        raise
    return pay, None


def refresh_invoice_pdf(session: Session, invoice: CustomerInvoice) -> None:
    """Generate and store invoice PDF + hash for issued invoice."""
    lines = list(
        session.execute(
            select(CustomerInvoiceLine).where(
                CustomerInvoiceLine.invoice_id == invoice.id
            )
        )
        .scalars()
        .all()
    )
    pdf_bytes = render_invoice_pdf(invoice=invoice, lines=lines)
    digest = _sha256_bytes(pdf_bytes)
    key = f"billing/invoices/{invoice.id}.pdf"
    store_pdf_in_assets_bucket(
        s3_key=key, body=pdf_bytes, content_type="application/pdf"
    )
    invoice.issued_pdf_s3_key = key
    invoice.issued_pdf_sha256 = digest
    invoice.pdf_template_version = PDF_TEMPLATE_VERSION
    session.flush()


def send_invoice_email(session: Session, *, invoice_id: UUID, to_email: str) -> None:
    inv = session.get(CustomerInvoice, invoice_id)
    if inv is None or not inv.issued_pdf_s3_key:
        return
    bucket = os.getenv("ASSETS_BUCKET_NAME", "").strip()
    if not bucket:
        return
    obj = get_s3_client().get_object(Bucket=bucket, Key=inv.issued_pdf_s3_key)
    pdf_bytes = obj["Body"].read()
    src = _confirmation_from_address()
    if not src:
        return
    num = inv.invoice_number or str(inv.id)
    subject = f"Invoice {num}"
    body_text = f"Please find invoice {num} attached."
    send_mime_email_with_optional_attachments(
        source=src,
        to_addresses=[to_email],
        subject=subject,
        body_text=body_text,
        body_html=f"<p>{body_text}</p>",
        attachments=[(f"invoice-{num}.pdf", "application/pdf", pdf_bytes)],
    )
    inv.email_sent_at = datetime.now(UTC)
    session.flush()


def payment_unapplied_amount(session: Session, payment_id: UUID) -> Decimal:
    """amount - sum(allocations) for same payment."""
    pay = session.get(CustomerPayment, payment_id)
    if pay is None:
        return Decimal("0")
    allocated = session.execute(
        select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0))
        .where(PaymentAllocation.payment_id == payment_id)
        .where(PaymentAllocation.currency == pay.currency)
    ).scalar_one()
    return Decimal(str(pay.amount)) - Decimal(str(allocated))
