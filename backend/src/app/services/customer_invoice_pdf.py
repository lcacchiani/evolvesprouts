"""Customer AR invoice PDF rendering (ReportLab platypus).

Invoice snapshot dates (``invoice_date``, ``due_date`` on ``CustomerInvoice``)
take precedence; previews compute dates when those columns are unset.

Environment:
- ``INVOICE_DISPLAY_TIMEZONE``: required for issued renders (non-preview); IANA id.
  Previews use UTC only (see ``render_invoice_pdf(..., preview=True)``).
- ``INVOICE_PAYMENT_TERMS_DAYS``: unset/empty defaults to 7; invalid values raise
  ``ValueError``.
- ``PUBLIC_WWW_BUSINESS_NAME``: trading name (From block).
- ``PUBLIC_WWW_BUSINESS_LEGAL_NAME``: optional legal entity name for footer.
- ``PUBLIC_WWW_BUSINESS_REGISTRATION``: BR / registration number for footer.

The Evolve Sprouts wordmark is embedded from ``app/assets/invoice/evolvesprouts-invoice-logo.png``
(raster export of the public-site SVG) so Lambda bundles match brand artwork without SVG
dependencies at runtime.

HKD amounts render with the ``HK$`` symbol (see architecture docs).

Footer jurisdiction copy ("Proudly registered in Hong Kong") is intentional product
copy for client invoices; exception documented in repository ``.cursorrules``.
"""

from __future__ import annotations

import html
import io
import os
import re
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image,
    LongTable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.enums import BillingInvoiceStatus

_SAMPLE_STYLES = getSampleStyleSheet()


def _esc(text: str) -> str:
    """Escape for ReportLab Paragraph (HTML-like); avoids stdlib ``xml`` (Semgrep / XXE)."""
    return html.escape(text, quote=True)


_INVOICE_JURISDICTION_LINE = "Proudly registered in Hong Kong"

# Brand-aligned body text (matches public-site logo palette).
_INV_TEXT = colors.HexColor("#1c3542")
_INV_MUTED = colors.HexColor("#5a6b73")
_INV_GRID = colors.HexColor("#d4dce0")
_INV_TITLE = colors.HexColor("#2c3e50")  # Title navy used in reference
_INV_HEADER_FILL = colors.HexColor("#2c3e50")  # Items table header dark fill
_INV_HEADER_TEXT = colors.white  # Items table header text
_INV_BODY_TEXT = colors.HexColor("#333333")  # Body text colour
_INV_LABEL_TEXT = colors.HexColor("#555555")  # "From:", "Bill To:", "Terms…" etc.
_INV_PANEL_FILL = colors.HexColor(
    "#eef2f5"
)  # Soft blue-grey card fill (dates / totals)
_INV_RULE = colors.HexColor("#cfd6da")  # Thin rules under header band & above Total
_INV_FOOTER_TEXT = colors.HexColor("#7f8c8d")  # Footer muted grey
_INV_LOGO_PATH = (
    Path(__file__).resolve().parent.parent
    / "assets"
    / "invoice"
    / "evolvesprouts-invoice-logo.png"
)


def _invoice_logo_flowable() -> Image | Paragraph:
    if not _INV_LOGO_PATH.is_file():
        return Paragraph("", _SAMPLE_STYLES["Normal"])
    img = Image(
        str(_INV_LOGO_PATH),
        width=38 * mm,
        height=38 * mm,
        kind="proportional",
    )
    img.hAlign = "LEFT"
    return img


def invoice_pdf_footer_text() -> str:
    """Footer from legal/trading name + registration (Option B includes HK jurisdiction when both)."""
    legal = (
        os.getenv("PUBLIC_WWW_BUSINESS_LEGAL_NAME", "").strip()
        or os.getenv("PUBLIC_WWW_BUSINESS_NAME", "").strip()
    )
    reg = os.getenv("PUBLIC_WWW_BUSINESS_REGISTRATION", "").strip()
    if not legal and not reg:
        return ""
    if legal and not reg:
        return legal
    if reg and not legal:
        return f"BR: {reg}"
    return f"{legal} | {_INVOICE_JURISDICTION_LINE} | BR: {reg}"


def payment_terms_days_or_raise() -> int:
    raw = os.getenv("INVOICE_PAYMENT_TERMS_DAYS", "").strip()
    if raw == "":
        return 7
    if not raw.isdigit():
        raise ValueError("INVOICE_PAYMENT_TERMS_DAYS must be a non-negative integer")
    val = int(raw)
    if val > 999:
        raise ValueError("INVOICE_PAYMENT_TERMS_DAYS must be at most 999")
    return val


def invoice_display_timezone_or_raise() -> ZoneInfo:
    """Timezone for issued invoice date math; required for issuance (non-preview)."""
    tz_name = os.getenv("INVOICE_DISPLAY_TIMEZONE", "").strip()
    if not tz_name:
        raise ValueError("INVOICE_DISPLAY_TIMEZONE is required for invoice issuance")
    try:
        return ZoneInfo(tz_name)
    except Exception as exc:
        raise ValueError(
            "INVOICE_DISPLAY_TIMEZONE is not a valid IANA timezone"
        ) from exc


def invoice_display_timezone_preview() -> ZoneInfo:
    """Previews use UTC when snapshot dates are computed on the fly."""
    return ZoneInfo("UTC")


def compute_invoice_snapshot_dates(issued_at: datetime) -> tuple[date, date]:
    """Compute persisted invoice_date and due_date at issue time from ``issued_at``."""
    tz = invoice_display_timezone_or_raise()
    terms_days = payment_terms_days_or_raise()
    inv_date = calendar_date_in_tz(issued_at, tz)
    due_date = inv_date + timedelta(days=terms_days)
    return inv_date, due_date


def calendar_date_in_tz(dt: datetime | None, tz: ZoneInfo) -> date:
    if dt is None:
        return datetime.now(UTC).astimezone(tz).date()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).astimezone(tz).date()
    return dt.astimezone(tz).date()


def split_address_lines(raw: str) -> list[str]:
    text = (raw or "").strip()
    if not text:
        return []
    normalized = text.replace("\\n", "\n")
    parts = re.split(r"[\n\r]+", normalized)
    return [p.strip() for p in parts if p.strip()]


def format_money(amount: Decimal, currency: str) -> str:
    code = currency.upper()[:3]
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


# Word-wrap at word boundaries into chunks of at most _MAX_DESC_CHUNK_CHARS;
# batched LongTable slices (SPAN for qty/unit/total) so page breaks can occur
# without repeating numbers on continuation rows.
_MAX_DESC_CHUNK_CHARS = 100
# Max body description rows per LongTable (plus optional header). Keep low so
# a slice still fits a partial page after header/footer/wrapped totals above.
_LINE_TABLE_BODY_ROWS_MAX = 14


def _description_row_strings(text: str) -> list[str]:
    """Split description into up-to-100-char chunks at word boundaries (no mid-word hard split)."""
    raw = text or ""
    if not raw.strip():
        return [raw]
    words: list[str] = []
    for token in raw.split():
        while len(token) > _MAX_DESC_CHUNK_CHARS:
            words.append(token[:_MAX_DESC_CHUNK_CHARS])
            token = token[_MAX_DESC_CHUNK_CHARS:]
        words.append(token)
    word_chunks: list[str] = []
    cur: list[str] = []
    cur_len = 0
    for w in words:
        add_len = len(w) + (1 if cur else 0)
        if cur_len + add_len > _MAX_DESC_CHUNK_CHARS and cur:
            word_chunks.append(" ".join(cur))
            cur = [w]
            cur_len = len(w)
        else:
            cur.append(w)
            cur_len += add_len
    if cur:
        word_chunks.append(" ".join(cur))
    return word_chunks


def render_invoice_pdf(
    *,
    invoice: CustomerInvoice,
    lines: list[CustomerInvoiceLine],
    preview: bool = False,
) -> bytes:
    """Render AR invoice PDF. Use ``preview=True`` for draft/void preview uploads."""
    inv_currency = invoice.currency.strip().upper()
    if len(inv_currency) != 3:
        raise ValueError("invoice.currency must be a 3-letter ISO code")

    ordered = sorted(lines, key=lambda x: x.line_order)
    for line in ordered:
        lc = line.currency.strip().upper()
        if lc != inv_currency:
            raise ValueError("Invoice line currency must match invoice currency")

    terms_days = payment_terms_days_or_raise()

    if invoice.invoice_date is not None:
        inv_date = invoice.invoice_date
    else:
        if preview:
            tz = invoice_display_timezone_preview()
        else:
            tz = invoice_display_timezone_or_raise()
        ref_dt = invoice.issued_at
        if ref_dt is None and invoice.status == BillingInvoiceStatus.DRAFT:
            ref_dt = datetime.now(UTC)
        inv_date = calendar_date_in_tz(ref_dt, tz)

    if invoice.due_date is not None:
        due_date = invoice.due_date
    else:
        due_date = inv_date + timedelta(days=terms_days)

    buf = io.BytesIO()
    margin_x = 10 * mm
    margin_top = 14 * mm
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
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=_INV_TITLE,
        alignment=TA_RIGHT,
        spaceAfter=0,
    )
    label_heading_style = ParagraphStyle(
        "InvLabelHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=_INV_LABEL_TEXT,
    )
    body_text_style = ParagraphStyle(
        "InvBodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=14,
        textColor=_INV_BODY_TEXT,
    )
    header_label_style = ParagraphStyle(
        "InvHeaderLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=_INV_HEADER_TEXT,
    )
    totals_label_style = ParagraphStyle(
        "InvTotalsLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=_INV_LABEL_TEXT,
        alignment=TA_RIGHT,
    )
    totals_value_style = ParagraphStyle(
        "InvTotalsValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=14,
        textColor=_INV_BODY_TEXT,
        alignment=TA_RIGHT,
    )
    totals_total_style = ParagraphStyle(
        "InvTotalsTotal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13.5,
        leading=16,
        textColor=_INV_BODY_TEXT,
        alignment=TA_RIGHT,
    )

    business_name = _esc(os.getenv("PUBLIC_WWW_BUSINESS_NAME", "").strip())
    address_lines = [
        _esc(p)
        for p in split_address_lines(os.getenv("PUBLIC_WWW_BUSINESS_ADDRESS", ""))
    ]
    bank_name = os.getenv("PUBLIC_WWW_BANK_NAME", "").strip()
    bank_holder = os.getenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "").strip()
    bank_number = os.getenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "").strip()
    has_bank_block = bool(bank_name or bank_holder or bank_number)

    inv_label = (invoice.invoice_number or "").strip()
    title_line = f"INVOICE {inv_label}" if inv_label else "INVOICE"

    hero_table = Table(
        [
            [
                _invoice_logo_flowable(),
                Paragraph(_esc(title_line), title_style),
            ]
        ],
        colWidths=[44 * mm, 146 * mm],
    )
    hero_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story: list = [hero_table]

    divider_table = Table(
        [[Paragraph(" ", body_text_style)]],
        colWidths=[190 * mm],
    )
    divider_table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.6, _INV_RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(divider_table)
    story.append(Spacer(1, 8))

    from_body_parts: list[str] = []
    if business_name:
        from_body_parts.append(business_name)
    from_body_parts.extend(address_lines)
    from_body_html = "<br/>".join(from_body_parts) if from_body_parts else ""

    from_cell = Table(
        [
            [Paragraph("From:", label_heading_style)],
            [Paragraph(from_body_html, body_text_style)],
        ],
        colWidths=[70 * mm],
    )
    from_cell.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    bill_body_parts: list[str] = []
    if invoice.bill_to_display_name:
        bill_body_parts.append(_esc(invoice.bill_to_display_name))
    if invoice.bill_to_email:
        bill_body_parts.append(_esc(invoice.bill_to_email))
    bill_body_html = "<br/>".join(bill_body_parts) if bill_body_parts else ""

    bill_cell = Table(
        [
            [Paragraph("Bill To:", label_heading_style)],
            [Paragraph(bill_body_html, body_text_style)],
        ],
        colWidths=[60 * mm],
    )
    bill_cell.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    inv_date_s = _esc(inv_date.isoformat())
    due_date_s = _esc(due_date.isoformat())
    dates_inner = Table(
        [
            [
                Paragraph(
                    f'<font color="#555555"><b>Invoice Date:</b></font> {inv_date_s}',
                    body_text_style,
                )
            ],
            [
                Paragraph(
                    f'<font color="#555555"><b>Due Date:</b></font> {due_date_s}',
                    body_text_style,
                )
            ],
        ],
        colWidths=[60 * mm],
    )
    dates_inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _INV_PANEL_FILL),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    header_band = Table(
        [[from_cell, bill_cell, dates_inner]],
        colWidths=[70 * mm, 60 * mm, 60 * mm],
    )
    header_band.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(header_band)
    story.append(Spacer(1, 14))

    header_row = [
        Paragraph("<b>Description</b>", header_label_style),
        Paragraph("<b>Quantity</b>", header_label_style),
        Paragraph("<b>Unit Price</b>", header_label_style),
        Paragraph("<b>Total</b>", header_label_style),
    ]

    first_line_item = True
    for line in ordered:
        desc = line.description or ""
        qty = line.quantity.quantize(Decimal("0.0001")).normalize()
        unit = format_money(line.unit_amount, inv_currency)
        ltot = format_money(line.line_total, inv_currency)
        qty_para = Paragraph(_esc(str(qty)), body_text_style)
        unit_para = Paragraph(_esc(unit), body_text_style)
        ltot_para = Paragraph(_esc(ltot), body_text_style)
        chunks = _description_row_strings(desc)

        seg_start = 0
        while seg_start < len(chunks):
            batch = chunks[seg_start : seg_start + _LINE_TABLE_BODY_ROWS_MAX]
            seg_end = seg_start + len(batch)

            table_rows: list[list] = []
            has_header = bool(first_line_item and seg_start == 0)
            if has_header:
                table_rows.append(header_row)

            for i, chunk in enumerate(batch):
                global_idx = seg_start + i
                desc_para = Paragraph(_esc(chunk), body_text_style)
                if global_idx == 0:
                    table_rows.append([desc_para, qty_para, unit_para, ltot_para])
                else:
                    empty = Paragraph("", body_text_style)
                    table_rows.append([desc_para, empty, empty, empty])

            n_rows = len(table_rows)
            style_cmds: list[tuple] = [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
            if has_header:
                hdr = 0
                style_cmds.extend(
                    [
                        ("BACKGROUND", (0, hdr), (-1, hdr), _INV_HEADER_FILL),
                        ("TEXTCOLOR", (0, hdr), (-1, hdr), _INV_HEADER_TEXT),
                        ("ALIGN", (0, hdr), (0, hdr), "LEFT"),
                        ("ALIGN", (1, hdr), (3, hdr), "LEFT"),
                        (
                            "LINEBELOW",
                            (0, hdr),
                            (-1, hdr),
                            0,
                            colors.transparent,
                        ),
                    ]
                )
                body_start = 1
            else:
                body_start = 0

            if body_start <= n_rows - 1:
                style_cmds.append(
                    ("ALIGN", (0, body_start), (0, n_rows - 1), "LEFT"),
                )
                style_cmds.append(
                    ("ALIGN", (1, body_start), (3, n_rows - 1), "RIGHT"),
                )

            for r in range(body_start, n_rows):
                style_cmds.append(
                    ("LINEBELOW", (0, r), (-1, r), 0.4, _INV_RULE),
                )

            repeat_rows = 1 if has_header else 0
            line_table = LongTable(
                table_rows,
                colWidths=[100 * mm, 22 * mm, 34 * mm, 34 * mm],
                repeatRows=repeat_rows,
            )
            line_table.setStyle(TableStyle(style_cmds))
            story.append(line_table)

            seg_start = seg_end

        first_line_item = False

    sub = format_money(invoice.subtotal, inv_currency)
    tot = format_money(invoice.total, inv_currency)
    show_tax = bool(invoice.tax_total and invoice.tax_total != Decimal("0"))
    inner_totals_rows: list[list] = [
        [
            Paragraph("Subtotal:", totals_label_style),
            Paragraph(sub, totals_value_style),
        ]
    ]
    if show_tax:
        inner_totals_rows.append(
            [
                Paragraph("Tax:", totals_label_style),
                Paragraph(
                    format_money(invoice.tax_total, inv_currency),
                    totals_value_style,
                ),
            ]
        )
    inner_totals_rows.append(
        [
            Paragraph("Total:", totals_total_style),
            Paragraph(tot, totals_total_style),
        ]
    )
    last_row = len(inner_totals_rows) - 1
    inner_totals = Table(
        inner_totals_rows,
        colWidths=[44 * mm, 36 * mm],
    )
    inner_totals.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _INV_PANEL_FILL),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEABOVE", (0, last_row), (-1, last_row), 0.5, _INV_RULE),
            ]
        )
    )

    totals_outer = Table(
        [
            [
                Paragraph("", body_text_style),
                inner_totals,
            ]
        ],
        colWidths=[110 * mm, 80 * mm],
    )
    totals_outer.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    story.append(totals_outer)
    story.append(Spacer(1, 16))

    terms_intro = (
        f"Payment is due within {terms_days} days from the issue of the invoice."
    )
    story.append(Paragraph("Terms &amp; Conditions:", label_heading_style))
    story.append(Paragraph(_esc(terms_intro), body_text_style))
    if has_bank_block:
        story.append(
            Paragraph(
                _esc("Please make payments using the bank details below:"),
                body_text_style,
            )
        )
        story.append(Spacer(1, 8))
        for bl in (
            f"<b>Bank:</b> {_esc(bank_name)}" if bank_name else "",
            f"<b>Account Number:</b> {_esc(bank_number)}" if bank_number else "",
            f"<b>Account Name:</b> {_esc(bank_holder)}" if bank_holder else "",
        ):
            if bl:
                story.append(Paragraph(bl, body_text_style))

    footer_text = invoice_pdf_footer_text()

    def _draw_footer(canvas_obj: canvas.Canvas, _doc: SimpleDocTemplate) -> None:
        if not footer_text:
            return
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica", 9)
        canvas_obj.setFillColor(_INV_FOOTER_TEXT)
        y_footer = 12 * mm
        canvas_obj.drawCentredString(A4[0] / 2, y_footer, footer_text)
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    return buf.getvalue()
