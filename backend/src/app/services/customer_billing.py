"""Customer billing (AR): PDF generation, S3, receipts, reservation capture."""

from __future__ import annotations

import hashlib
import io
import os
import re
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from xml.sax.saxutils import escape as xml_escape
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models.enums import (
    BillingInvoiceStatus,
    BillingPaymentDirection,
    BillingPaymentStatus,
)
from app.db.models.payment_allocation import DocumentCounter, PaymentAllocation
from app.services.aws_clients import get_s3_client
from app.services.email import send_mime_email_with_optional_attachments
from app.utils.logging import get_logger

logger = get_logger(__name__)

PDF_TEMPLATE_VERSION = "billing-v2"
_SCOPE_DEFAULT = "default"
_DOC_INVOICE = "invoice"
_DOC_RECEIPT = "receipt"


def _confirmation_from_address() -> str:
    return os.getenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "").strip()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _invoice_payment_terms_days() -> int:
    raw = os.getenv("INVOICE_PAYMENT_TERMS_DAYS", "7").strip()
    if not raw.isdigit():
        return 7
    return max(0, int(raw))


def _invoice_display_timezone() -> ZoneInfo:
    tz_name = os.getenv("SALES_RECAP_DISPLAY_TIMEZONE", "").strip()
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            logger.warning(
                "Invalid SALES_RECAP_DISPLAY_TIMEZONE; using Asia/Hong_Kong",
                extra={"tz": tz_name},
            )
    return ZoneInfo("Asia/Hong_Kong")


def _invoice_calendar_date_in_tz(dt: datetime | None, tz: ZoneInfo) -> date:
    if dt is None:
        return datetime.now(UTC).astimezone(tz).date()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).astimezone(tz).date()
    return dt.astimezone(tz).date()


def _format_money(amount: Decimal, currency: str) -> str:
    code = (currency or "XXX").upper()[:3]
    q = amount.quantize(Decimal("0.01"))
    symbol = {
        "USD": "$",
        "HKD": "HK$",
        "GBP": "£",
        "EUR": "€",
        "CNY": "¥",
    }.get(code)
    if symbol:
        return f"{symbol}{q:,.2f}"
    return f"{q:,.2f} {code}"


def _split_address_lines(raw: str) -> list[str]:
    text = (raw or "").strip()
    if not text:
        return []
    parts = re.split(r"[\n\r]+|(?:\s*/\s*)", text)
    return [p.strip() for p in parts if p.strip()]


def _invoice_pdf_footer_text() -> str:
    name = os.getenv("PUBLIC_WWW_BUSINESS_NAME", "").strip()
    reg = os.getenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "").strip()
    parts: list[str] = []
    if name:
        parts.append(name)
    if reg:
        parts.append("Proudly registered in Hong Kong")
        parts.append(f"BR: {reg}")
    return " | ".join(parts)


def render_invoice_pdf(
    *,
    invoice: CustomerInvoice,
    lines: list[CustomerInvoiceLine],
) -> bytes:
    """Render AR invoice PDF (immutable snapshot), styled for client delivery."""
    buf = io.BytesIO()
    margin_x = 14 * mm
    margin_top = 16 * mm
    margin_bottom = 18 * mm
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=margin_x,
        rightMargin=margin_x,
        topMargin=margin_top,
        bottomMargin=margin_bottom,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvTitle",
        parent=styles["Heading1"],
        fontSize=14,
        spaceAfter=10,
    )
    label_style = ParagraphStyle(
        "InvLabel",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
    )
    body_style = ParagraphStyle(
        "InvBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=12,
    )
    tz = _invoice_display_timezone()
    terms_days = _invoice_payment_terms_days()
    inv_date = _invoice_calendar_date_in_tz(invoice.issued_at, tz)
    due_date = inv_date + timedelta(days=terms_days)

    business_name = xml_escape(os.getenv("PUBLIC_WWW_BUSINESS_NAME", "").strip())
    address_lines = [
        xml_escape(p)
        for p in _split_address_lines(os.getenv("PUBLIC_WWW_BUSINESS_ADDRESS", ""))
    ]
    bank_name = os.getenv("PUBLIC_WWW_BANK_NAME", "").strip()
    bank_holder = os.getenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "").strip()
    bank_number = os.getenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "").strip()

    inv_label = (invoice.invoice_number or "").strip()
    title_line = f"INVOICE {inv_label}" if inv_label else "INVOICE"

    story: list = [Paragraph(title_line, title_style)]

    from_blocks: list[str] = []
    if business_name:
        from_blocks.append(f"<b>From:</b><br/>{business_name}")
    else:
        from_blocks.append("<b>From:</b>")
    for segment in address_lines:
        from_blocks[-1] += f"<br/>{segment}"

    bill_parts = ["<b>Bill To:</b>"]
    if invoice.bill_to_display_name:
        bill_parts.append(xml_escape(invoice.bill_to_display_name))
    if invoice.bill_to_email:
        bill_parts.append(xml_escape(invoice.bill_to_email))
    bill_block = "<br/>".join(bill_parts)

    header_data = [
        [
            Paragraph("<br/>".join(from_blocks), label_style),
            Paragraph(bill_block, label_style),
        ],
        [
            Paragraph(
                f"<b>Invoice Date:</b> {inv_date.isoformat()}",
                label_style,
            ),
            Paragraph(f"<b>Due Date:</b> {due_date.isoformat()}", label_style),
        ],
    ]
    header_table = Table(header_data, colWidths=[90 * mm, 90 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 6))

    ordered = sorted(lines, key=lambda x: x.line_order)
    table_rows: list[list] = [
        [
            Paragraph("<b>Description</b>", label_style),
            Paragraph("<b>Quantity</b>", label_style),
            Paragraph("<b>Unit Price</b>", label_style),
            Paragraph("<b>Total</b>", label_style),
        ]
    ]
    cur = (invoice.currency or "HKD").upper()[:3]
    for line in ordered:
        desc = line.description or ""
        qty = line.quantity.quantize(Decimal("0.0001")).normalize()
        unit = _format_money(line.unit_amount, line.currency or cur)
        ltot = _format_money(line.line_total, line.currency or cur)
        table_rows.append(
            [
                Paragraph(xml_escape(desc), label_style),
                Paragraph(xml_escape(str(qty)), label_style),
                Paragraph(xml_escape(unit), label_style),
                Paragraph(xml_escape(ltot), label_style),
            ]
        )

    line_table = Table(
        table_rows,
        colWidths=[72 * mm, 24 * mm, 38 * mm, 38 * mm],
        repeatRows=1,
    )
    line_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(line_table)
    story.append(Spacer(1, 10))

    sub = _format_money(invoice.subtotal, invoice.currency)
    tot = _format_money(invoice.total, invoice.currency)
    tax_block: list = []
    tax_block.append(
        Table(
            [
                [
                    Paragraph("<b>Subtotal:</b>", body_style),
                    Paragraph(sub, body_style),
                ],
            ],
            colWidths=[140 * mm, 40 * mm],
        )
    )
    if invoice.tax_total and invoice.tax_total != Decimal("0"):
        tax_block.append(
            Table(
                [
                    [
                        Paragraph("<b>Tax:</b>", body_style),
                        Paragraph(
                            _format_money(invoice.tax_total, invoice.currency),
                            body_style,
                        ),
                    ],
                ],
                colWidths=[140 * mm, 40 * mm],
            )
        )
    tax_block.append(
        Table(
            [
                [
                    Paragraph("<b>Total:</b>", body_style),
                    Paragraph(f"<b>{tot}</b>", body_style),
                ],
            ],
            colWidths=[140 * mm, 40 * mm],
        )
    )
    for t in tax_block:
        story.append(t)

    story.append(Spacer(1, 14))
    terms_intro = (
        f"Payment is due within {terms_days} days from the issue of the invoice."
    )
    story.append(Paragraph(f"<b>Terms &amp; Conditions:</b>", body_style))
    story.append(Paragraph(terms_intro, body_style))
    story.append(
        Paragraph(
            "Please make payments using the bank details below:",
            body_style,
        )
    )
    story.append(Spacer(1, 8))

    bank_lines = [
        f"<b>Bank:</b> {xml_escape(bank_name)}" if bank_name else "",
        f"<b>Account Number:</b> {xml_escape(bank_number)}" if bank_number else "",
        f"<b>Account Name:</b> {xml_escape(bank_holder)}" if bank_holder else "",
    ]
    for bl in bank_lines:
        if bl:
            story.append(Paragraph(bl, body_style))

    footer_text = _invoice_pdf_footer_text()

    def _draw_footer(canvas_obj: canvas.Canvas, _doc: SimpleDocTemplate) -> None:
        if not footer_text:
            return
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(colors.grey)
        y_footer = 12 * mm
        canvas_obj.drawCentredString(A4[0] / 2, y_footer, footer_text)
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
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
) -> tuple[CustomerPayment | None, UUID | None, bool]:
    """Insert customer_payment for a new enrollment.

    Receipts are not created at booking time; staff create them after invoice
    reconciliation via admin confirm or equivalent succeeded paths.

    Returns:
        Tuple of (payment or existing row, receipt_id always None here,
        duplicate_stripe_payment_intent) where the third flag is True when an
        existing row was returned for the same Stripe payment intent id.
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
            return existing_pi, None, True
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
                return dup, None, True
        raise
    return pay, None, False


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


def _invoice_preview_s3_key(invoice_id: UUID) -> str:
    return f"billing/invoices/preview/{invoice_id}.pdf"


def upload_invoice_preview_pdf(session: Session, invoice: CustomerInvoice) -> str:
    """Render invoice lines to PDF and store under a non-canonical preview key (no DB mutation)."""
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
    key = _invoice_preview_s3_key(invoice.id)
    store_pdf_in_assets_bucket(
        s3_key=key, body=pdf_bytes, content_type="application/pdf"
    )
    return key


def ensure_invoice_pdf_storage(session: Session, invoice: CustomerInvoice) -> str:
    """Return S3 object key for opening the invoice PDF (issued artifact or preview upload).

    Issued invoices reuse ``issued_pdf_s3_key`` when set. Draft and void invoices
    upload to ``billing/invoices/preview/{id}.pdf`` so preview does not overwrite
    issued PDF metadata or hashes.
    """
    if (
        invoice.status == BillingInvoiceStatus.ISSUED
        and invoice.issued_pdf_s3_key
        and invoice.issued_pdf_s3_key.strip()
    ):
        return invoice.issued_pdf_s3_key.strip()
    return upload_invoice_preview_pdf(session, invoice)


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
