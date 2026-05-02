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

HKD amounts render with the ``HK$`` symbol (see architecture docs).

Footer jurisdiction copy ("Proudly registered in Hong Kong") is intentional product
copy for client invoices; exception documented in repository ``.cursorrules``.
"""

from __future__ import annotations

import io
import os
import re
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from xml.sax.saxutils import escape as xml_escape
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.enums import BillingInvoiceStatus

_INVOICE_JURISDICTION_LINE = "Proudly registered in Hong Kong"


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
        raise ValueError("INVOICE_DISPLAY_TIMEZONE is not a valid IANA timezone") from exc


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


_MAX_DESC_CHUNK_CHARS = 220


def _description_word_chunks(text: str, *, max_chars: int) -> list[str]:
    """Split long descriptions into multiple table rows (page breaks between chunks)."""
    raw = text or ""
    if not raw.strip():
        return [raw]
    words = raw.split()
    chunks: list[str] = []
    cur: list[str] = []
    cur_len = 0
    for w in words:
        add_len = len(w) + (1 if cur else 0)
        if cur_len + add_len > max_chars and cur:
            chunks.append(" ".join(cur))
            cur = [w]
            cur_len = len(w)
        else:
            cur.append(w)
            cur_len += add_len
    if cur:
        chunks.append(" ".join(cur))
    return chunks


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
    body_bold_style = ParagraphStyle(
        "InvBodyBold",
        parent=styles["Normal"],
        fontSize=10,
        leading=12,
        fontName="Helvetica-Bold",
    )

    business_name = xml_escape(os.getenv("PUBLIC_WWW_BUSINESS_NAME", "").strip())
    address_lines = [
        xml_escape(p) for p in split_address_lines(os.getenv("PUBLIC_WWW_BUSINESS_ADDRESS", ""))
    ]
    bank_name = os.getenv("PUBLIC_WWW_BANK_NAME", "").strip()
    bank_holder = os.getenv("PUBLIC_WWW_BANK_ACCOUNT_HOLDER", "").strip()
    bank_number = os.getenv("PUBLIC_WWW_BANK_ACCOUNT_NUMBER", "").strip()
    has_bank_block = bool(bank_name or bank_holder or bank_number)

    inv_label = (invoice.invoice_number or "").strip()
    title_line = f"INVOICE {inv_label}" if inv_label else "INVOICE"

    story: list = [Paragraph(xml_escape(title_line), title_style)]

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

    table_rows: list[list] = [
        [
            Paragraph("<b>Description</b>", label_style),
            Paragraph("<b>Quantity</b>", label_style),
            Paragraph("<b>Unit Price</b>", label_style),
            Paragraph("<b>Total</b>", label_style),
        ]
    ]
    span_commands: list[tuple] = []
    for line in ordered:
        desc = line.description or ""
        qty = line.quantity.quantize(Decimal("0.0001")).normalize()
        unit = format_money(line.unit_amount, inv_currency)
        ltot = format_money(line.line_total, inv_currency)
        qty_para = Paragraph(xml_escape(str(qty)), label_style)
        unit_para = Paragraph(xml_escape(unit), label_style)
        ltot_para = Paragraph(xml_escape(ltot), label_style)
        chunks = _description_word_chunks(desc, max_chars=_MAX_DESC_CHUNK_CHARS)
        for chunk in chunks:
            desc_para = Paragraph(xml_escape(chunk), label_style)
            table_rows.append([desc_para, qty_para, unit_para, ltot_para])

    line_table = LongTable(
        table_rows,
        colWidths=[72 * mm, 24 * mm, 38 * mm, 38 * mm],
        repeatRows=1,
    )
    style_cmds = [
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 1), (3, -1), "RIGHT"),
    ]
    line_table.setStyle(TableStyle(style_cmds))
    story.append(line_table)
    story.append(Spacer(1, 10))

    sub = format_money(invoice.subtotal, inv_currency)
    tot = format_money(invoice.total, inv_currency)
    show_tax = bool(invoice.tax_total and invoice.tax_total != Decimal("0"))
    totals_rows: list[list] = [
        [
            Paragraph("<b>Subtotal:</b>", body_style),
            Paragraph(sub, body_style),
        ]
    ]
    if show_tax:
        totals_rows.append(
            [
                Paragraph("<b>Tax:</b>", body_style),
                Paragraph(format_money(invoice.tax_total, inv_currency), body_style),
            ]
        )
    totals_rows.append(
        [
            Paragraph("<b>Total:</b>", body_bold_style),
            Paragraph(f"<b>{xml_escape(tot)}</b>", body_bold_style),
        ]
    )
    totals_table = Table(totals_rows, colWidths=[140 * mm, 40 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(totals_table)

    story.append(Spacer(1, 14))
    terms_intro = (
        f"Payment is due within {terms_days} days from the issue of the invoice."
    )
    story.append(Paragraph("<b>Terms &amp; Conditions:</b>", body_style))
    story.append(Paragraph(xml_escape(terms_intro), body_style))
    if has_bank_block:
        story.append(
            Paragraph(
                "Please make payments using the bank details below:",
                body_style,
            )
        )
        story.append(Spacer(1, 8))
        for bl in (
            f"<b>Bank:</b> {xml_escape(bank_name)}" if bank_name else "",
            f"<b>Account Number:</b> {xml_escape(bank_number)}" if bank_number else "",
            f"<b>Account Name:</b> {xml_escape(bank_holder)}" if bank_holder else "",
        ):
            if bl:
                story.append(Paragraph(bl, body_style))

    footer_text = invoice_pdf_footer_text()

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
