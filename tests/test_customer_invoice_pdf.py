"""Tests for ``customer_invoice_pdf`` (AR invoice PDF rendering)."""

from __future__ import annotations

import io
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.db.models.enums import BillingInvoiceStatus
from app.services import customer_billing
from app.services.customer_invoice_pdf import (
    compute_invoice_snapshot_dates,
    invoice_pdf_footer_text,
    payment_terms_days_or_raise,
    render_invoice_pdf,
)


def _pdf_text(pdf: bytes) -> str:
    from pypdf import PdfReader

    r = PdfReader(io.BytesIO(pdf))
    return "\n".join(p.extract_text() or "" for p in r.pages)


def _base_invoice_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Trading Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Test Bank")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "123")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "Holder")


def _inv_line(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "line_order": 0,
        "description": "Line",
        "quantity": Decimal("1"),
        "unit_amount": Decimal("100.00"),
        "line_total": Decimal("100.00"),
        "currency": "HKD",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_invoice_pdf_versions_distinct() -> None:
    assert customer_billing.INVOICE_PDF_TEMPLATE_VERSION == "billing-invoice-v4"
    assert customer_billing.RECEIPT_PDF_TEMPLATE_VERSION == "billing-receipt-v1"
    assert customer_billing.INVOICE_PDF_TEMPLATE_VERSION != (
        customer_billing.RECEIPT_PDF_TEMPLATE_VERSION
    )


def test_description_not_split_midword(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Evolve Sprouts")
    monkeypatch.setenv(
        "PUBLIC_WWW_BUSINESS_ADDRESS",
        "507, 5/F, Arion Commercial Centre\n2-12 Queen's Road West\n"
        "Sheung Wan\nHong Kong SAR",
    )
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", "Evolve Sprouts Ltd")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "41492636-000-02-25-0")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "389 - Mox Bank Limited")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "749 86477821")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "IDA DE GREGORIO")
    inv = SimpleNamespace(
        invoice_number="I-2603-027",
        currency="HKD",
        subtotal=Decimal("583.33"),
        tax_total=Decimal("0"),
        total=Decimal("583.33"),
        bill_to_display_name="Bump and Co",
        bill_to_email=None,
        issued_at=datetime(2026, 3, 25, 12, 0, tzinfo=UTC),
        invoice_date=date(2026, 3, 25),
        due_date=date(2026, 4, 1),
        status=BillingInvoiceStatus.ISSUED,
    )
    line = SimpleNamespace(
        line_order=0,
        description="Weaning Workshop for Bump & Co",
        quantity=Decimal("1"),
        unit_amount=Decimal("583.33"),
        line_total=Decimal("583.33"),
        currency="HKD",
    )
    text = _pdf_text(render_invoice_pdf(invoice=inv, lines=[line], preview=False))
    assert "Weaning Workshop for Bump & Co" in text


def test_invoice_template_v4_layout_smoke(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Evolve Sprouts")
    monkeypatch.setenv(
        "PUBLIC_WWW_BUSINESS_ADDRESS",
        "507, 5/F, Arion Commercial Centre\n2-12 Queen's Road West\n"
        "Sheung Wan\nHong Kong SAR",
    )
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", "Evolve Sprouts Ltd")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "41492636-000-02-25-0")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "389 - Mox Bank Limited")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "749 86477821")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "IDA DE GREGORIO")
    inv = SimpleNamespace(
        invoice_number="I-2603-027",
        currency="HKD",
        subtotal=Decimal("583.33"),
        tax_total=Decimal("0"),
        total=Decimal("583.33"),
        bill_to_display_name="Bump and Co",
        bill_to_email=None,
        issued_at=datetime(2026, 3, 25, 12, 0, tzinfo=UTC),
        invoice_date=date(2026, 3, 25),
        due_date=date(2026, 4, 1),
        status=BillingInvoiceStatus.ISSUED,
    )
    line = SimpleNamespace(
        line_order=0,
        description="Weaning Workshop for Bump & Co",
        quantity=Decimal("1"),
        unit_amount=Decimal("583.33"),
        line_total=Decimal("583.33"),
        currency="HKD",
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    from pypdf import PdfReader

    r = PdfReader(io.BytesIO(pdf))
    assert len(r.pages) == 1
    text = _pdf_text(pdf)
    for fragment in (
        "INVOICE I-2603-027",
        "From:",
        "Bill To:",
        "Invoice Date:",
        "Due Date:",
        "Description",
        "Quantity",
        "Unit Price",
        "Total",
        "Subtotal:",
        "Evolve Sprouts Ltd | Proudly registered in Hong Kong | BR: 41492636-000-02-25-0",
    ):
        assert fragment in text


def test_footer_text_option_b_combinations(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_REGISTRATION", raising=False)
    assert invoice_pdf_footer_text() == ""

    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", "Evolve Sprouts Ltd")
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_REGISTRATION", raising=False)
    assert invoice_pdf_footer_text() == "Evolve Sprouts Ltd"

    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", raising=False)
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Trading")
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_REGISTRATION", raising=False)
    assert invoice_pdf_footer_text() == "Trading"

    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "BR-99")
    assert invoice_pdf_footer_text() == "BR: BR-99"

    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", "Evolve Sprouts Ltd")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "41492636-000-02-25-0")
    assert (
        invoice_pdf_footer_text()
        == "Evolve Sprouts Ltd | Proudly registered in Hong Kong | BR: 41492636-000-02-25-0"
    )


def test_payment_terms_days_default_and_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INVOICE_PAYMENT_TERMS_DAYS", raising=False)
    assert payment_terms_days_or_raise() == 7

    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "")
    assert payment_terms_days_or_raise() == 7

    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "14")
    assert payment_terms_days_or_raise() == 14

    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "x")
    with pytest.raises(ValueError):
        payment_terms_days_or_raise()

    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "1000")
    with pytest.raises(ValueError):
        payment_terms_days_or_raise()


def test_currency_mismatch_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _base_invoice_env(monkeypatch)
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("100"),
        tax_total=Decimal("0"),
        total=Decimal("100"),
        bill_to_display_name="C",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 15, 12, 0, tzinfo=UTC),
        invoice_date=None,
        due_date=None,
        status=BillingInvoiceStatus.ISSUED,
    )
    bad_line = _inv_line(currency="USD")
    with pytest.raises(ValueError, match="currency"):
        render_invoice_pdf(invoice=inv, lines=[bad_line], preview=False)


def test_hkd_symbol_in_output(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_invoice_env(monkeypatch)
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("583.33"),
        tax_total=Decimal("0"),
        total=Decimal("583.33"),
        bill_to_display_name="Client",
        bill_to_email=None,
        issued_at=datetime(2026, 3, 25, 12, 0, tzinfo=UTC),
        invoice_date=date(2026, 3, 25),
        due_date=date(2026, 4, 1),
        status=BillingInvoiceStatus.ISSUED,
    )
    lines = [
        _inv_line(
            description="Workshop",
            unit_amount=Decimal("583.33"),
            line_total=Decimal("583.33"),
        )
    ]
    pdf = render_invoice_pdf(invoice=inv, lines=lines, preview=False)
    text = _pdf_text(pdf)
    assert "HK$583.33" in text or "HK$583" in text


def test_address_preserves_5f(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_invoice_env(monkeypatch)
    monkeypatch.setenv(
        "PUBLIC_WWW_BUSINESS_ADDRESS",
        "507, 5/F, Arion Commercial Centre\n2-12 Queen's Road West",
    )
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="X",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False)
    text = _pdf_text(pdf)
    assert "5/F" in text


def test_missing_trading_name_from_header_survives(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="Y",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False)
    assert pdf.startswith(b"%PDF")
    assert "From:" in _pdf_text(pdf)


def test_bank_block_omitted_when_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.delenv("PUBLIC_WWW_BANK_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", raising=False)
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="Z",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False)
    text = _pdf_text(pdf)
    assert "Please make payments" not in text
    assert "Bank:" not in text


def test_bill_to_email_shown_or_omitted(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_invoice_env(monkeypatch)
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="Org",
        bill_to_email="pay@example.com",
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    t1 = _pdf_text(render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False))
    assert "pay@example.com" in t1

    inv2 = SimpleNamespace(**{**inv.__dict__, "bill_to_email": None})
    t2 = _pdf_text(render_invoice_pdf(invoice=inv2, lines=[_inv_line()], preview=False))
    assert "pay@example.com" not in t2


def test_long_description_multipage(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_invoice_env(monkeypatch)
    long_desc = ("Very long line description. " * 400).strip()
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="Z",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(
        invoice=inv,
        lines=[_inv_line(description=long_desc)],
        preview=False,
    )
    from pypdf import PdfReader

    r = PdfReader(io.BytesIO(pdf))
    assert len(r.pages) >= 2


def test_preview_uses_utc_without_display_tz(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INVOICE_DISPLAY_TIMEZONE", raising=False)
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "B")
    inv = SimpleNamespace(
        invoice_number=None,
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="A",
        bill_to_email=None,
        issued_at=None,
        invoice_date=None,
        due_date=None,
        status=BillingInvoiceStatus.DRAFT,
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=True)
    assert pdf.startswith(b"%PDF")


def test_issued_requires_display_timezone(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INVOICE_DISPLAY_TIMEZONE", raising=False)
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "B")
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="A",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 15, 12, 0, tzinfo=UTC),
        invoice_date=None,
        due_date=None,
        status=BillingInvoiceStatus.ISSUED,
    )
    with pytest.raises(ValueError, match="INVOICE_DISPLAY_TIMEZONE"):
        render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False)


def test_compute_snapshot_dates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    issued = datetime(2026, 3, 25, 14, 0, tzinfo=UTC)
    inv_d, due_d = compute_invoice_snapshot_dates(issued)
    assert inv_d.isoformat() == "2026-03-25"
    assert due_d.isoformat() == "2026-04-01"


def test_refresh_invoice_sets_invoice_template_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ASSETS_BUCKET_NAME", "b")
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "UTC")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Bk")

    inv = SimpleNamespace(
        id=uuid4(),
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="X",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
        invoice_number="INV-1",
    )
    line = SimpleNamespace(
        line_order=0,
        description="L",
        quantity=Decimal("1"),
        unit_amount=Decimal("1"),
        line_total=Decimal("1"),
        currency="HKD",
    )
    session = MagicMock()

    def _scalar_lines(*_a: object, **_k: object):
        m = MagicMock()
        m.scalars.return_value.all.return_value = [line]
        return m

    session.execute.side_effect = _scalar_lines
    monkeypatch.setattr(
        "app.services.customer_billing.store_pdf_in_assets_bucket",
        lambda **_: None,
    )
    customer_billing.refresh_invoice_pdf(session, inv)  # type: ignore[arg-type]
    assert inv.pdf_template_version == customer_billing.INVOICE_PDF_TEMPLATE_VERSION


def test_receipt_row_gets_receipt_template_version(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "UTC")
    from app.db.models.enums import BillingPaymentDirection, BillingPaymentStatus
    from app.db.models.customer_payment import CustomerPayment

    pay = SimpleNamespace(
        id=uuid4(),
        direction=BillingPaymentDirection.INBOUND,
        status=BillingPaymentStatus.SUCCEEDED,
        amount=Decimal("10"),
        currency="HKD",
        method="stripe_card",
        stripe_payment_intent_id=None,
    )
    session = MagicMock()
    session.execute.return_value.scalar_one_or_none.return_value = None
    session.get.side_effect = lambda model, pk: (
        pay if model is CustomerPayment else None
    )

    monkeypatch.setattr(
        "app.services.customer_billing.next_receipt_number",
        lambda *_a, **_k: ("RCP-1", 1),
    )
    monkeypatch.setattr(
        "app.services.customer_billing.allocation_invoice_labels_for_payment",
        lambda *_a, **_k: [],
    )

    rec = customer_billing.create_receipt_for_succeeded_inbound_payment(
        session, payment=pay  # type: ignore[arg-type]
    )
    assert rec.pdf_template_version == customer_billing.RECEIPT_PDF_TEMPLATE_VERSION
