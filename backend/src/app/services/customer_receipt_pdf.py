"""Customer payment receipt PDF (minimal ReportLab canvas)."""

from __future__ import annotations

import io
from decimal import Decimal

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt


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
