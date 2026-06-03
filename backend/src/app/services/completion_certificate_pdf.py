"""Completion certificate PDF rendering (ReportLab)."""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.config.public_www import get_public_www

COMPLETION_CERTIFICATE_PDF_TEMPLATE_VERSION = "completion-certificate-v1"

_CERTIFICATE_BODY_TEMPLATE = (
    "has successfully completed the {brand_line} training in "
    "Montessori-informed newborn care, demonstrating the knowledge and practice "
    "of respect-based, developmentally grounded caregiving in the first twelve "
    "weeks of life."
)

_CREDENTIAL_FOOTER_PREFIX = "CERTIFIED CARETAKER HONG KONG"


@dataclass(frozen=True)
class CompletionCertificatePdfContext:
    """Inputs for rendering a completion certificate PDF."""

    recipient_display_name: str
    program_title: str
    participation_date: date
    trading_name: str
    partner_display_name: str | None
    partner_signer_name: str | None
    es_founder_name: str
    body_text: str


def build_certificate_body_text(
    *,
    trading_name: str,
    partner_display_name: str | None,
) -> str:
    """Fill the global certificate body template (paragraph after recipient name)."""
    if partner_display_name:
        brand_line = f"{trading_name} × {partner_display_name}"
    else:
        brand_line = trading_name
    return _CERTIFICATE_BODY_TEMPLATE.format(brand_line=brand_line)


def certificate_trading_name() -> str:
    return get_public_www("BUSINESS_NAME").strip()


def certificate_es_founder_name() -> str:
    return get_public_www("CERTIFICATE_ES_FOUNDER_NAME").strip()


def _header_brand_line(ctx: CompletionCertificatePdfContext) -> str:
    if ctx.partner_display_name:
        return f"{ctx.trading_name.upper()} × {ctx.partner_display_name.upper()}"
    return ctx.trading_name.upper()


def _format_awarded_date(participation_date: date) -> str:
    return f"AWARDED {participation_date.strftime('%d %B %Y').upper()}"


def _credential_footer(participation_date: date) -> str:
    return f"{_CREDENTIAL_FOOTER_PREFIX} · {participation_date.year}"


def render_completion_certificate_pdf(ctx: CompletionCertificatePdfContext) -> bytes:
    """Render a landscape completion certificate PDF."""
    page_size = landscape(A4)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=page_size,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CertTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#1a3d2e"),
        spaceAfter=6,
    )
    brand_style = ParagraphStyle(
        "CertBrand",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#4a6741"),
        spaceAfter=10,
    )
    program_style = ParagraphStyle(
        "CertProgram",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#2d4a3e"),
        spaceAfter=14,
    )
    recipient_style = ParagraphStyle(
        "CertRecipient",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        "CertBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#333333"),
        spaceAfter=18,
    )
    sig_name_style = ParagraphStyle(
        "CertSigName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=13,
        alignment=TA_CENTER,
    )
    date_style = ParagraphStyle(
        "CertDate",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#4a6741"),
        spaceBefore=8,
        spaceAfter=6,
    )
    footer_style = ParagraphStyle(
        "CertFooter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#666666"),
    )

    story: list[object] = []
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(_header_brand_line(ctx), brand_style))
    story.append(Paragraph("CERTIFICATE OF COMPLETION", title_style))
    story.append(Paragraph(_escape_xml(ctx.program_title), program_style))
    story.append(Paragraph("This certifies that", body_style))
    story.append(Paragraph(_escape_xml(ctx.recipient_display_name), recipient_style))
    story.append(Paragraph(_escape_xml(ctx.body_text), body_style))
    story.append(Spacer(1, 6 * mm))

    sig_blocks: list[str] = []
    sig_blocks.append(
        f'<para align="center"><b>{_escape_xml(ctx.es_founder_name)}</b><br/>'
        f"FOUNDER · { _escape_xml(ctx.trading_name.upper()) }</para>"
    )
    if ctx.partner_display_name and ctx.partner_signer_name:
        sig_blocks.append(
            f'<para align="center"><b>{_escape_xml(ctx.partner_signer_name)}</b><br/>'
            f"FOUNDER · { _escape_xml(ctx.partner_display_name.upper()) }</para>"
        )
    for block in sig_blocks:
        story.append(Paragraph(block, sig_name_style))
        story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(_format_awarded_date(ctx.participation_date), date_style))
    story.append(Paragraph(_credential_footer(ctx.participation_date), footer_style))

    doc.build(story)
    return buf.getvalue()


def _escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
