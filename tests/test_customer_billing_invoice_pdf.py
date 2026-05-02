"""Tests for customer AR invoice PDF rendering."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.customer_billing import PDF_TEMPLATE_VERSION, render_invoice_pdf


def _pdf_text(pdf: bytes) -> str:
    from pypdf import PdfReader

    r = PdfReader(io.BytesIO(pdf))
    return "\n".join(p.extract_text() or "" for p in r.pages)


@pytest.fixture
def sample_invoice_and_lines() -> tuple[SimpleNamespace, list[SimpleNamespace]]:
    inv_id = uuid4()
    enr_id = uuid4()
    issued = datetime(2026, 3, 25, 12, 0, tzinfo=UTC)
    inv = SimpleNamespace(
        id=inv_id,
        invoice_number="I-2603-027",
        currency="HKD",
        subtotal=Decimal("500.00"),
        tax_total=Decimal("0"),
        total=Decimal("500.00"),
        bill_to_display_name="Bump and Co",
        bill_to_email="bump@example.com",
        issued_at=issued,
    )
    line = SimpleNamespace(
        id=uuid4(),
        invoice_id=inv_id,
        enrollment_id=enr_id,
        line_order=0,
        description="Weaning Workshop for Bump & Co",
        quantity=Decimal("1"),
        unit_amount=Decimal("500.00"),
        line_total=Decimal("500.00"),
        currency="HKD",
    )
    return inv, [line]


def test_pdf_template_version_bumped() -> None:
    assert PDF_TEMPLATE_VERSION == "billing-v2"


def test_render_invoice_pdf_uses_env_and_invoice_data(
    monkeypatch: pytest.MonkeyPatch,
    sample_invoice_and_lines: tuple[SimpleNamespace, list[SimpleNamespace]],
) -> None:
    inv, lines = sample_invoice_and_lines
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("SALES_RECAP_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Evolve Sprouts")
    monkeypatch.setenv(
        "PUBLIC_WWW_BUSINESS_ADDRESS",
        "507, 5/F, Arion Commercial Centre\n2-12 Queen's Road West",
    )
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "41492636-000-02-25-0")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "389 - Mox Bank Limited")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "749 86477821")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "IDA DE GREGORIO")

    pdf = render_invoice_pdf(invoice=inv, lines=lines)
    assert pdf.startswith(b"%PDF")
    text = _pdf_text(pdf)
    assert "INVOICE" in text
    assert "I-2603-027" in text
    assert "Evolve Sprouts" in text
    assert "Bump and Co" in text
    assert "2026-03-25" in text
    assert "2026-04-01" in text
    assert "Subtotal" in text
    assert "Total" in text
    assert "Mox Bank" in text
    assert "41492636-000-02-25-0" in text
    assert "Payment is due within 7 days" in text


def test_render_invoice_pdf_shows_tax_when_nonzero(
    monkeypatch: pytest.MonkeyPatch,
    sample_invoice_and_lines: tuple[SimpleNamespace, list[SimpleNamespace]],
) -> None:
    inv, lines = sample_invoice_and_lines
    inv.subtotal = Decimal("500.00")
    inv.tax_total = Decimal("50.00")
    inv.total = Decimal("550.00")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Acme Ltd")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Test Bank")

    pdf = render_invoice_pdf(invoice=inv, lines=lines)
    text = _pdf_text(pdf)
    assert "Tax" in text
    assert "50.00" in text


def test_invoice_payment_terms_days_invalid_falls_back_to_seven(
    monkeypatch: pytest.MonkeyPatch,
    sample_invoice_and_lines: tuple[SimpleNamespace, list[SimpleNamespace]],
) -> None:
    inv, lines = sample_invoice_and_lines
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "not-a-number")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Acme Ltd")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Test Bank")

    pdf = render_invoice_pdf(invoice=inv, lines=lines)
    text = _pdf_text(pdf)
    assert "2026-04-01" in text
