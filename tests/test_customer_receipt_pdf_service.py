from __future__ import annotations

import io
from decimal import Decimal
from types import SimpleNamespace

from app.services.customer_receipt_pdf import render_receipt_pdf


def _pdf_text(pdf: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def test_render_receipt_pdf_includes_receipt_and_payment_details() -> None:
    receipt = SimpleNamespace(
        receipt_number="RCP-2026-0001",
        total_amount=Decimal("1500.0000"),
        currency="HKD",
    )
    payment = SimpleNamespace(
        method="stripe",
        stripe_payment_intent_id="pi_test_123",
    )

    pdf_bytes = render_receipt_pdf(
        receipt=receipt,
        payment=payment,
        allocation_invoice_numbers=[("INV-001", Decimal("1500.0000"))],
    )
    text = _pdf_text(pdf_bytes)

    assert pdf_bytes.startswith(b"%PDF")
    assert "Payment receipt" in text
    assert "RCP-2026-0001" in text
    assert "pi_test_123" in text
    assert "INV-001" in text


def test_render_receipt_pdf_omits_optional_stripe_reference() -> None:
    receipt = SimpleNamespace(
        receipt_number="RCP-2026-0002",
        total_amount=Decimal("500.0000"),
        currency="HKD",
    )
    payment = SimpleNamespace(method="fps", stripe_payment_intent_id=None)

    pdf_bytes = render_receipt_pdf(
        receipt=receipt,
        payment=payment,
        allocation_invoice_numbers=[],
    )
    text = _pdf_text(pdf_bytes)

    assert "Stripe PI:" not in text
    assert "Applied to invoices:" not in text
