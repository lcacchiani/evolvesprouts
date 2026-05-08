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


def _pdf_layout(pdf: bytes):
    import fitz

    doc = fitz.open(stream=pdf, filetype="pdf")
    page = doc[0]
    blocks = page.get_text("dict")["blocks"]
    spans, images = [], []
    for b in blocks:
        if b["type"] == 0:
            for ln in b["lines"]:
                for sp in ln["spans"]:
                    spans.append(sp)
        else:
            images.append(b)
    return doc, page, spans, images


def _v6_standard_invoice(
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[SimpleNamespace, SimpleNamespace]:
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
    return inv, line


def _pixmap_pt_coords(page, dpi: int = 120):
    """Return (pix, s) where pixel row for PDF pt y is int(y * s)."""
    pix = page.get_pixmap(dpi=dpi)
    s = pix.width / page.rect.width
    return pix, s


def _rgb_close(
    rgb: tuple[int, int, int], target: tuple[int, int, int], tol: int = 4
) -> bool:
    return all(abs(a - b) <= tol for a, b in zip(rgb, target))


def test_v6_logo_size_and_position(monkeypatch: pytest.MonkeyPatch) -> None:
    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    _doc, _page, _spans, images = _pdf_layout(pdf)
    if not images:
        pytest.skip("invoice logo asset not present in test environment")
    logos = []
    for im in images:
        bbox = im["bbox"]
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        if 140 <= w <= 155 and 140 <= h <= 155:
            logos.append(bbox)
    assert logos, "expected hero wordmark image dimensions"
    bbox = logos[0]
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    # 52mm rendered box (~147 pt) preserves aspect; PNG includes ~16% transparent
    # padding so the visible content lands at ~100pt to match the reference template.
    assert 140 <= w <= 155
    assert 140 <= h <= 155
    assert 25 <= bbox[0] <= 35


def test_v6_invoice_title_centred_with_logo(monkeypatch: pytest.MonkeyPatch) -> None:
    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    _doc, _page, spans, _images = _pdf_layout(pdf)
    inv_spans = [s for s in spans if "INVOICE" in s["text"]]
    assert inv_spans
    bb = inv_spans[0]["bbox"]
    assert 85 <= bb[1] <= 130
    assert bb[2] > 540


def test_v6_dates_panel_full_height_via_image_render(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[0]
    pix, s = _pixmap_pt_coords(page)
    # Dates panel spans roughly y_pt 218-368 in v6; sample mid-panel.
    x_pt, y_pt = 480, 320
    rgb = pix.pixel(int(x_pt * s), int(y_pt * s))
    assert _rgb_close(rgb, (247, 249, 250))


def test_v6_items_header_navy_fill(monkeypatch: pytest.MonkeyPatch) -> None:
    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[0]
    pix, s = _pixmap_pt_coords(page)
    # Items header navy band sits around y_pt 400-437 in v6.
    rgb = pix.pixel(int(200 * s), int(420 * s))
    assert _rgb_close(rgb, (51, 73, 93))


def test_v6_totals_card_width(monkeypatch: pytest.MonkeyPatch) -> None:
    from reportlab.lib.units import mm

    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[0]
    pix, s = _pixmap_pt_coords(page)
    W = pix.width
    # Totals card spans y_pt ~493-580 in v6; sample mid-card.
    y_pt = 530
    y = int(y_pt * s)

    def matches_panel(rgb: tuple[int, int, int]) -> bool:
        return _rgb_close(rgb, (247, 249, 250))

    longest = 0.0
    left_pt = 0.0
    in_run = False
    start = 0
    for x in range(W):
        if matches_panel(pix.pixel(x, y)):
            if not in_run:
                start = x
                in_run = True
        else:
            if in_run:
                w_pt = (x - 1 - start + 1) / s
                if w_pt > longest:
                    longest = w_pt
                    left_pt = start / s
                in_run = False
    if in_run:
        w_pt = (W - 1 - start + 1) / s
        if w_pt > longest:
            longest = w_pt
            left_pt = start / s

    assert 82 * mm <= longest <= 92 * mm
    assert 105 * mm <= left_pt <= 125 * mm


def _totals_card_bounds_on_page(
    page, *, y_sample_pt: float = 530.0
) -> tuple[float, float, float] | None:
    """Return (left_pt, width_pt, bottom_y_pt) if a totals-sized panel is found."""
    from reportlab.lib.units import mm

    pix, s = _pixmap_pt_coords(page)
    W = pix.width
    y = int(y_sample_pt * s)

    def matches_panel(rgb: tuple[int, int, int]) -> bool:
        return _rgb_close(rgb, (247, 249, 250))

    longest = 0.0
    left_pt = 0.0
    in_run = False
    start = 0
    for x in range(W):
        if matches_panel(pix.pixel(x, y)):
            if not in_run:
                start = x
                in_run = True
        else:
            if in_run:
                w_pt = (x - 1 - start + 1) / s
                if w_pt > longest:
                    longest = w_pt
                    left_pt = start / s
                in_run = False
    if in_run:
        w_pt = (W - 1 - start + 1) / s
        if w_pt > longest:
            longest = w_pt
            left_pt = start / s

    if not (82 * mm <= longest <= 92 * mm and 105 * mm <= left_pt <= 125 * mm):
        return None

    xc = int((left_pt + longest / 2) * s)
    y_max: float | None = None
    for y_pt_i in range(int(400 * s), int(700 * s)):
        if matches_panel(pix.pixel(xc, y_pt_i)):
            py = y_pt_i / s
            y_max = py if y_max is None else max(y_max, py)
    if y_max is None:
        return None
    return left_pt, longest, y_max


def _find_totals_card_in_pdf(pdf: bytes) -> tuple[int, float, float, float]:
    import fitz

    doc = fitz.open(stream=pdf, filetype="pdf")
    for pi in range(len(doc)):
        b = _totals_card_bounds_on_page(doc[pi])
        if b is not None:
            return pi, b[0], b[1], b[2]
    msg = "totals card panel not found in PDF"
    raise AssertionError(msg)


def test_v7_fps_qr_below_totals_card(monkeypatch: pytest.MonkeyPatch) -> None:
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
    monkeypatch.setenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "FPSMerchant")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "91234567")
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
    totals_pi, left_pt, width_pt, totals_bottom = _find_totals_card_in_pdf(pdf)
    x0, x1 = left_pt, left_pt + width_pt

    import fitz

    doc = fitz.open(stream=pdf, filetype="pdf")
    qr_below = False
    for pi in range(len(doc)):
        page = doc[pi]
        for im in (
            b for b in page.get_text("dict")["blocks"] if b["type"] == 1
        ):
            bbox = im["bbox"]
            ix0, ix1 = bbox[0], bbox[2]
            iw = ix1 - ix0
            if iw > 120:
                continue
            if ix0 < x0 - 2 or ix1 > x1 + 2:
                continue
            if pi > totals_pi:
                qr_below = True
                break
            if pi == totals_pi and bbox[1] > totals_bottom + 8:
                qr_below = True
                break
        if qr_below:
            break
    assert qr_below, "expected FPS QR image under totals card column"

    bank_spans: list = []
    for pi in range(len(doc)):
        page = doc[pi]
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if b["type"] != 0:
                continue
            for ln in b["lines"]:
                for sp in ln["spans"]:
                    if sp["text"].lstrip().startswith("Bank:"):
                        bank_spans.append(sp)
    assert bank_spans
    for s in bank_spans:
        assert s["bbox"][0] < left_pt - 1


def test_v6_no_rule_below_last_item_row(monkeypatch: pytest.MonkeyPatch) -> None:
    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[0]
    thin_grey_between = 0
    for d in page.get_drawings():
        if d.get("type") != "s":
            continue
        r = d["rect"]
        w = d.get("width") or 0
        c = d.get("color")
        if abs(float(w) - 0.4) > 0.05 or not c or len(c) != 3:
            continue
        if max(c) < 0.75:
            continue
        y = r.y0
        if 460 <= y <= 500:
            thin_grey_between += 1
    assert thin_grey_between == 0


def test_v6_footer_y_anchor(monkeypatch: pytest.MonkeyPatch) -> None:
    inv, line = _v6_standard_invoice(monkeypatch)
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    _doc, _page, spans, _images = _pdf_layout(pdf)
    foot = [
        s for s in spans if "Proudly registered" in s["text"] or "BR:" in s["text"]
    ]
    assert foot
    y0 = foot[0]["bbox"][1]
    assert 780 <= y0 <= 795


def test_v6_multiline_last_chunk_skips_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_ADDRESS", "addr")
    monkeypatch.delenv("PUBLIC_WWW_BANK_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", raising=False)
    desc = ("a " * 51).rstrip()
    from app.services.customer_invoice_pdf import _description_row_strings

    assert len(_description_row_strings(desc)) == 2
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("3"),
        tax_total=Decimal("0"),
        total=Decimal("3"),
        bill_to_display_name="X",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    lines = [
        SimpleNamespace(
            line_order=i,
            description=desc,
            quantity=Decimal("1"),
            unit_amount=Decimal("1"),
            line_total=Decimal("1"),
            currency="HKD",
        )
        for i in range(3)
    ]
    pdf = render_invoice_pdf(invoice=inv, lines=lines, preview=False)
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[0]
    thin = 0
    for d in page.get_drawings():
        if d.get("type") != "s":
            continue
        w = d.get("width") or 0
        if abs(float(w) - 0.4) <= 0.05:
            thin += 1
    assert thin == 5


def test_v6_tax_total_line_above_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_ADDRESS", "a")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "B")
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("100"),
        tax_total=Decimal("10"),
        total=Decimal("110"),
        bill_to_display_name="X",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False)
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[0]
    mid_rules = [
        d["rect"].y0
        for d in page.get_drawings()
        if d.get("type") == "s"
        and abs((d.get("width") or 0) - 0.6) < 0.05
        and d.get("rect")
    ]
    assert len(mid_rules) >= 1


def test_v6_wide_hkd_amount_fits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_ADDRESS", "a")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "B")
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("1234567.89"),
        tax_total=Decimal("0"),
        total=Decimal("1234567.89"),
        bill_to_display_name="X",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(
        invoice=inv,
        lines=[
            _inv_line(
                unit_amount=Decimal("1234567.89"),
                line_total=Decimal("1234567.89"),
            )
        ],
        preview=False,
    )
    text = _pdf_text(pdf)
    assert "HK$" in text
    assert "1,234" in text
    assert "567.89" in text


def test_invoice_pdf_versions_distinct() -> None:
    assert customer_billing.INVOICE_PDF_TEMPLATE_VERSION == "billing-invoice-v8"
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


def test_invoice_template_v6_layout_smoke(monkeypatch: pytest.MonkeyPatch) -> None:
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


def test_rendered_pdf_includes_explicit_invoice_date(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_invoice_env(monkeypatch)
    inv = SimpleNamespace(
        invoice_number="N-2025",
        currency="HKD",
        subtotal=Decimal("1"),
        tax_total=Decimal("0"),
        total=Decimal("1"),
        bill_to_display_name="Client",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 10, tzinfo=UTC),
        invoice_date=date(2025, 5, 15),
        due_date=date(2025, 5, 22),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[_inv_line()], preview=False)
    text = _pdf_text(pdf)
    assert "2025-05-15" in text
    assert "2025-05-22" in text


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


def _pdf_page_image_blocks(pdf: bytes, page_index: int = 0) -> list:
    import fitz

    page = fitz.open(stream=pdf, filetype="pdf")[page_index]
    return [b for b in page.get_text("dict")["blocks"] if b["type"] == 1]


def _pdf_all_image_blocks(pdf: bytes) -> list:
    import fitz

    doc = fitz.open(stream=pdf, filetype="pdf")
    blocks: list = []
    for i in range(len(doc)):
        page = doc[i]
        blocks.extend(b for b in page.get_text("dict")["blocks"] if b["type"] == 1)
    return blocks


def test_zero_total_hides_due_date_and_terms(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Test Bank")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "123")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "Holder")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "FPSCo")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "91234567")
    inv = SimpleNamespace(
        invoice_number="Z1",
        currency="HKD",
        subtotal=Decimal("0"),
        tax_total=Decimal("0"),
        total=Decimal("0"),
        bill_to_display_name="Client",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    line = _inv_line(
        unit_amount=Decimal("0"),
        line_total=Decimal("0"),
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    text = _pdf_text(pdf)
    assert "Invoice Date:" in text
    assert "Total:" in text
    assert "Due Date:" not in text
    assert "Terms & Conditions" not in text
    assert "Please make payments" not in text
    assert "Bank:" not in text


def test_nonzero_total_shows_fps_block(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Bk")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "999")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "H")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "FPSMerchant")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "91234567")
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("10"),
        tax_total=Decimal("0"),
        total=Decimal("10"),
        bill_to_display_name="C",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(
        invoice=inv,
        lines=[_inv_line(unit_amount=Decimal("10"), line_total=Decimal("10"))],
        preview=False,
    )
    text = _pdf_text(pdf)
    assert "FPS QR code or the bank" in text.replace("\n", " ")
    assert "Bank:" in text
    assert len(_pdf_all_image_blocks(pdf)) == 3


def test_nonzero_total_without_fps_config_falls_back_to_bank_only_copy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Bk")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "1")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "H")
    monkeypatch.delenv("PUBLIC_WWW_FPS_MERCHANT_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", raising=False)
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("5"),
        tax_total=Decimal("0"),
        total=Decimal("5"),
        bill_to_display_name="C",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(
        invoice=inv,
        lines=[_inv_line(unit_amount=Decimal("5"), line_total=Decimal("5"))],
        preview=False,
    )
    text = _pdf_text(pdf)
    assert "Please make payments using the bank details below:" in text
    assert "FPS QR code or the bank" not in text
    assert len(_pdf_page_image_blocks(pdf)) == 1


def test_nonzero_total_with_fps_only_no_bank_omits_bank_lines(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.delenv("PUBLIC_WWW_BANK_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", raising=False)
    monkeypatch.setenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "FPSOnly")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "91234567")
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="HKD",
        subtotal=Decimal("3"),
        tax_total=Decimal("0"),
        total=Decimal("3"),
        bill_to_display_name="C",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(
        invoice=inv,
        lines=[_inv_line(unit_amount=Decimal("3"), line_total=Decimal("3"))],
        preview=False,
    )
    text = _pdf_text(pdf)
    assert "FPS QR code below:" in text.replace("\n", " ")
    assert "Bank:" not in text
    assert len(_pdf_all_image_blocks(pdf)) == 3


def test_nonzero_total_non_hkd_skips_fps_qr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Bk")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "1")
    monkeypatch.setenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "H")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "FPS")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "91234567")
    inv = SimpleNamespace(
        invoice_number="N1",
        currency="USD",
        subtotal=Decimal("10"),
        tax_total=Decimal("0"),
        total=Decimal("10"),
        bill_to_display_name="C",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    pdf = render_invoice_pdf(
        invoice=inv,
        lines=[
            _inv_line(
                unit_amount=Decimal("10"),
                line_total=Decimal("10"),
                currency="USD",
            )
        ],
        preview=False,
    )
    text = _pdf_text(pdf)
    assert "Please make payments using the bank details below:" in text
    assert "FPS QR code or the bank" not in text
    assert len(_pdf_page_image_blocks(pdf)) == 1


def test_negative_total_suppresses_payment_block(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INVOICE_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    monkeypatch.setenv("INVOICE_PAYMENT_TERMS_DAYS", "7")
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Co")
    monkeypatch.setenv("PUBLIC_WWW_BANK_NAME", "Bk")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "FPS")
    monkeypatch.setenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "91234567")
    inv = SimpleNamespace(
        invoice_number="CR1",
        currency="HKD",
        subtotal=Decimal("-50"),
        tax_total=Decimal("0"),
        total=Decimal("-50"),
        bill_to_display_name="C",
        bill_to_email=None,
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        invoice_date=date(2026, 1, 1),
        due_date=date(2026, 1, 8),
        status=BillingInvoiceStatus.ISSUED,
    )
    line = _inv_line(
        unit_amount=Decimal("-50"),
        line_total=Decimal("-50"),
    )
    pdf = render_invoice_pdf(invoice=inv, lines=[line], preview=False)
    text = _pdf_text(pdf)
    assert "Due Date:" not in text
    assert "Terms & Conditions" not in text
    assert "Please make payments" not in text


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
