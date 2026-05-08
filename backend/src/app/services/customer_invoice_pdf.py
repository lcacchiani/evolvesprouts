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
- ``PUBLIC_WWW_FPS_MERCHANT_NAME`` / ``PUBLIC_WWW_FPS_MOBILE_NUMBER``: optional FPS QR on
  invoices when ``total > 0`` and currency is HKD (align with public-site FPS config).

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
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Flowable,
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
from app.services.fps_qr_payload import build_fps_payload
from app.services.fps_qr_pdf_image import render_fps_qr_png

_SAMPLE_STYLES = getSampleStyleSheet()


def _esc(text: str) -> str:
    """Escape for ReportLab Paragraph (HTML-like); avoids stdlib ``xml`` (Semgrep / XXE)."""
    return html.escape(text, quote=True)


_INVOICE_JURISDICTION_LINE = "Proudly registered in Hong Kong"

_INV_TEXT = colors.HexColor("#1c3542")
_INV_MUTED = colors.HexColor("#5a6b73")
_INV_GRID = colors.HexColor("#d4dce0")
_INV_TITLE = colors.HexColor("#2c3e50")
_INV_HEADER_FILL = colors.HexColor("#33495d")
_INV_HEADER_TEXT = colors.white
_INV_BODY_TEXT = colors.HexColor("#333333")
_INV_LABEL_TEXT = colors.HexColor("#555555")
_INV_PANEL_FILL = colors.HexColor("#f7f9fa")
_INV_RULE = colors.HexColor("#cfd6da")
_INV_DIVIDER = colors.HexColor("#1c2a36")
_INV_TOTAL_RULE = colors.HexColor("#33495d")
_INV_FOOTER_TEXT = colors.HexColor("#7f8c8d")
_INV_LOGO_PATH = (
    Path(__file__).resolve().parent.parent
    / "assets"
    / "invoice"
    / "evolvesprouts-invoice-logo.png"
)
_INV_FPS_LOGO_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "invoice" / "fps-logo.png"
)

# Source PNG has ~16.3% transparent padding on each side; render the box at
# 52mm so the visible content lands at ~35mm to match the reference template.
_INV_LOGO_BOX_MM = 52


class RoundedPanel(Flowable):
    """Fixed-size flowable that paints a rounded-corner background and renders an inner table on top."""

    def __init__(
        self,
        inner: Flowable,
        width: float,
        height: float,
        fill: colors.Color,
        radius: float = 4.0,
        valign: str = "middle",
        inset_top: float = 0.0,
    ) -> None:
        super().__init__()
        self._inner = inner
        self.width = width
        self.height = height
        self._fill = fill
        self._radius = radius
        self._valign = valign
        self._inset_top = inset_top

    def wrap(self, _aw: float, _ah: float) -> tuple[float, float]:
        return self.width, self.height

    def draw(self) -> None:
        c = self.canv
        c.saveState()
        c.setFillColor(self._fill)
        c.setStrokeColor(self._fill)
        c.roundRect(
            0,
            0,
            self.width,
            self.height,
            self._radius,
            stroke=0,
            fill=1,
        )
        c.restoreState()
        _, inner_h = self._inner.wrap(self.width, self.height)
        if self._valign == "top":
            y_offset = max(0.0, self.height - inner_h - self._inset_top)
        else:
            y_offset = max(0.0, (self.height - inner_h) / 2.0)
        self._inner.drawOn(c, 0, y_offset)


def _invoice_logo_flowable() -> Image | Paragraph:
    if not _INV_LOGO_PATH.is_file():
        return Paragraph("", _SAMPLE_STYLES["Normal"])
    img = Image(
        str(_INV_LOGO_PATH),
        width=_INV_LOGO_BOX_MM * mm,
        height=_INV_LOGO_BOX_MM * mm,
        kind="proportional",
    )
    img.hAlign = "LEFT"
    return img


def _fps_logo_image() -> Image | None:
    """FPS brand mark for payment band (~25 mm × 12 mm max, right-aligned under totals)."""
    if not _INV_FPS_LOGO_PATH.is_file():
        return None
    img = Image(
        str(_INV_FPS_LOGO_PATH),
        width=25 * mm,
        height=12 * mm,
        kind="proportional",
    )
    img.hAlign = "RIGHT"
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


def add_payment_terms(inv_date: date) -> date:
    """Return ``inv_date + INVOICE_PAYMENT_TERMS_DAYS`` using the same env helper."""
    return inv_date + timedelta(days=payment_terms_days_or_raise())


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
    inv_date = calendar_date_in_tz(issued_at, tz)
    due_date = add_payment_terms(inv_date)
    return inv_date, due_date


def today_in_invoice_display_tz_or_utc() -> date:
    """Calendar-today in INVOICE_DISPLAY_TIMEZONE; fall back to UTC if env var unset/invalid."""
    tz_name = os.getenv("INVOICE_DISPLAY_TIMEZONE", "").strip()
    if not tz_name:
        return datetime.now(UTC).date()
    try:
        return datetime.now(UTC).astimezone(ZoneInfo(tz_name)).date()
    except (ZoneInfoNotFoundError, OSError, ValueError, TypeError):
        return datetime.now(UTC).date()


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
_LINE_TABLE_BODY_ROWS_MAX = 8


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
    margin_top = 10 * mm
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
        leading=18,
        textColor=_INV_LABEL_TEXT,
    )
    body_text_style = ParagraphStyle(
        "InvBodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=18,
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

    is_non_positive_total = invoice.total <= Decimal("0")
    show_due_date = not is_non_positive_total

    fps_merchant = os.getenv("PUBLIC_WWW_FPS_MERCHANT_NAME", "").strip()
    fps_mobile = os.getenv("PUBLIC_WWW_FPS_MOBILE_NUMBER", "").strip()
    fps_payload: str | None = None
    if (
        not is_non_positive_total
        and inv_currency == "HKD"
        and fps_merchant
        and fps_mobile
    ):
        fps_payload = build_fps_payload(
            fps_merchant,
            fps_mobile,
            invoice.total,
            currency=inv_currency,
        )

    inv_label = (invoice.invoice_number or "").strip()
    title_line = f"INVOICE {inv_label}" if inv_label else "INVOICE"

    # Hero row: logo box (52mm rendered → ~35mm visible after PNG transparent
    # padding) on the left, INVOICE title vertically centred on the right.
    hero_table = Table(
        [
            [
                _invoice_logo_flowable(),
                Paragraph(_esc(title_line), title_style),
            ]
        ],
        colWidths=[60 * mm, 130 * mm],
    )
    hero_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story: list = [hero_table]

    story.append(Spacer(1, 14))

    divider_table = Table(
        [[Paragraph(" ", body_text_style)]],
        colWidths=[190 * mm],
        rowHeights=[1],
    )
    divider_table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 1.2, _INV_DIVIDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(divider_table)
    story.append(Spacer(1, 22))

    from_body_parts: list[str] = []
    if business_name:
        from_body_parts.append(business_name)
    from_body_parts.extend(address_lines)
    from_body_html = "<br/>".join(from_body_parts) if from_body_parts else ""

    body_lines_count = (1 if business_name else 0) + len(address_lines)
    from_lines = min(6, max(2, body_lines_count))
    header_row_pt = max(150, 22 + (from_lines * 18) + 22)
    if not show_due_date:
        header_row_pt = max(132, header_row_pt - 18)

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
                ("BOTTOMPADDING", (0, 0), (0, 0), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 0),
            ]
        )
    )

    bill_body_parts: list[str] = []
    if invoice.bill_to_display_name:
        name_lines = [
            ln.strip() for ln in invoice.bill_to_display_name.split("\n") if ln.strip()
        ]
        if name_lines:
            bill_body_parts.append("<br/>".join(_esc(ln) for ln in name_lines))
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
                ("BOTTOMPADDING", (0, 0), (0, 0), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 0),
            ]
        )
    )

    inv_date_s = _esc(inv_date.isoformat())
    due_date_s = _esc(due_date.isoformat())
    date_rows: list[list] = [
        [
            Paragraph(
                f'<font color="#555555"><b>Invoice Date:</b></font> {inv_date_s}',
                body_text_style,
            )
        ],
    ]
    if show_due_date:
        date_rows.append(
            [
                Paragraph(
                    f'<font color="#555555"><b>Due Date:</b></font> {due_date_s}',
                    body_text_style,
                )
            ],
        )
    dates_inner = Table(date_rows, colWidths=[58 * mm])
    dates_style_cmds: list[tuple] = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]
    if len(date_rows) == 1:
        dates_style_cmds.append(("BOTTOMPADDING", (0, 0), (0, 0), 14))
    else:
        dates_style_cmds.extend(
            [
                ("BOTTOMPADDING", (0, 0), (0, 0), 14),
                ("TOPPADDING", (0, 1), (0, 1), 0),
                ("BOTTOMPADDING", (0, 1), (0, 1), 0),
            ]
        )
    dates_inner.setStyle(TableStyle(dates_style_cmds))

    dates_panel = RoundedPanel(
        dates_inner,
        width=58 * mm,
        height=header_row_pt,
        fill=_INV_PANEL_FILL,
        radius=4.0,
        valign="top",
        inset_top=20.0,
    )

    header_band = Table(
        [[from_cell, bill_cell, dates_panel]],
        colWidths=[70 * mm, 62 * mm, 58 * mm],
        rowHeights=[header_row_pt],
    )
    header_band.setStyle(
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
    story.append(header_band)
    story.append(Spacer(1, 32))

    header_row = [
        Paragraph("<b>Description</b>", header_label_style),
        Paragraph("<b>Quantity</b>", header_label_style),
        Paragraph("<b>Unit Price</b>", header_label_style),
        Paragraph("<b>Total</b>", header_label_style),
    ]

    first_line_item = True
    for line_idx, line in enumerate(ordered):
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
            n_batch = len(batch)
            row_body_start = 1 if has_header else 0
            style_cmds: list[tuple] = [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
            if has_header:
                hdr = 0
                style_cmds.extend(
                    [
                        ("BACKGROUND", (0, hdr), (-1, hdr), _INV_HEADER_FILL),
                        ("TEXTCOLOR", (0, hdr), (-1, hdr), _INV_HEADER_TEXT),
                        ("ALIGN", (0, hdr), (-1, hdr), "LEFT"),
                        ("TOPPADDING", (0, hdr), (-1, hdr), 12),
                        ("BOTTOMPADDING", (0, hdr), (-1, hdr), 12),
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
                    ("ALIGN", (0, body_start), (-1, n_rows - 1), "LEFT"),
                )

            if n_batch > 1:
                last_body_row = row_body_start + n_batch - 1
                for col in (1, 2, 3):
                    style_cmds.append(
                        ("SPAN", (col, row_body_start), (col, last_body_row))
                    )

            is_last_line_last_slice = line_idx == len(ordered) - 1 and seg_end == len(
                chunks
            )
            for r in range(body_start, n_rows):
                if is_last_line_last_slice and r == n_rows - 1:
                    continue
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
    totals_card_w = 88 * mm
    totals_card_h = 30 * (last_row + 1) + 28
    inner_totals = Table(
        inner_totals_rows,
        colWidths=[48 * mm, 40 * mm],
    )
    totals_style_cmds: list[tuple] = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEABOVE", (1, last_row), (1, last_row), 0.6, _INV_TOTAL_RULE),
    ]
    inner_totals.setStyle(TableStyle(totals_style_cmds))

    totals_panel = RoundedPanel(
        inner_totals,
        width=totals_card_w,
        height=totals_card_h,
        fill=_INV_PANEL_FILL,
        radius=4.0,
    )

    totals_outer = Table(
        [
            [
                Paragraph("", body_text_style),
                totals_panel,
            ]
        ],
        colWidths=[102 * mm, 88 * mm],
        rowHeights=[totals_card_h],
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
    story.append(Spacer(1, 18))
    story.append(totals_outer)
    story.append(Spacer(1, 36))

    terms_intro = (
        f"Payment is due within {terms_days} days from the issue of the invoice."
    )
    if not is_non_positive_total:
        story.append(Paragraph("Terms &amp; Conditions:", label_heading_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(_esc(terms_intro), body_text_style))

        if has_bank_block or fps_payload is not None:
            if has_bank_block and fps_payload is not None:
                pay_intro = (
                    "Please make payments using the FPS QR code or the bank "
                    "details below:"
                )
            elif has_bank_block:
                pay_intro = "Please make payments using the bank details below:"
            else:
                pay_intro = "Please make payments using the FPS QR code below:"

            story.append(Spacer(1, 12))

            pay_left_w = 102 * mm
            pay_right_w = 88 * mm

            bank_rows: list[list] = [
                [Paragraph(_esc(pay_intro), body_text_style)],
            ]
            if has_bank_block:
                bank_rows.append([Spacer(1, 12)])
                bank_lines = [
                    f"Bank: {_esc(bank_name)}" if bank_name else "",
                    f"Account Number: {_esc(bank_number)}" if bank_number else "",
                    f"Account Name: {_esc(bank_holder)}" if bank_holder else "",
                ]
                first_bank = True
                for bl in bank_lines:
                    if not bl:
                        continue
                    if not first_bank:
                        bank_rows.append([Spacer(1, 2)])
                    bank_rows.append([Paragraph(bl, body_text_style)])
                    first_bank = False

            bank_cell = Table(bank_rows, colWidths=[pay_left_w])
            bank_cell.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ]
                )
            )

            fps_stack_rows: list[list] = []
            if fps_payload is not None:
                logo_flow = _fps_logo_image()
                if logo_flow is not None:
                    fps_stack_rows.append([logo_flow])
                    fps_stack_rows.append([Spacer(1, 6)])
                qr_png = render_fps_qr_png(fps_payload, size_px=256)
                qr_img = Image(
                    io.BytesIO(qr_png),
                    width=35 * mm,
                    height=35 * mm,
                    kind="proportional",
                )
                qr_img.hAlign = "RIGHT"
                fps_stack_rows.append([qr_img])

            if fps_stack_rows:
                fps_cell_inner = Table(
                    fps_stack_rows,
                    colWidths=[pay_right_w],
                )
                fps_cell_inner.setStyle(
                    TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                            ("TOPPADDING", (0, 0), (-1, -1), 0),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                        ]
                    )
                )
                fps_cell = fps_cell_inner
            else:
                fps_cell = Paragraph("", body_text_style)

            pay_table = Table(
                [[bank_cell, fps_cell]],
                colWidths=[pay_left_w, pay_right_w],
            )
            pay_table.setStyle(
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
            story.append(pay_table)
    else:
        story.append(Spacer(1, 36))

    footer_text = invoice_pdf_footer_text()

    def _draw_footer(canvas_obj: canvas.Canvas, _doc: SimpleDocTemplate) -> None:
        if not footer_text:
            return
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica", 9)
        canvas_obj.setFillColor(_INV_FOOTER_TEXT)
        y_footer = 14 * mm
        canvas_obj.drawCentredString(A4[0] / 2, y_footer, footer_text)
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    return buf.getvalue()
