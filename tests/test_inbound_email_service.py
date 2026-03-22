from __future__ import annotations

from email.message import EmailMessage

from app.db.models import AssetType
from app.services.inbound_email import (
    EMAIL_INVOICE_BODY_FILE_NAME,
    invoice_attachments_for_ingest,
    parse_raw_email,
    select_invoice_attachments,
)


def test_parse_raw_email_extracts_supported_invoice_attachments() -> None:
    message = EmailMessage()
    message["From"] = "Vendor Billing <billing@example.com>"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Invoice INV-100"
    message["Date"] = "Fri, 21 Mar 2026 09:00:00 +0000"
    message.set_content("Please see attached invoice.")
    message.add_attachment(
        b"%PDF-1.7",
        maintype="application",
        subtype="pdf",
        filename="invoice.pdf",
    )

    parsed = parse_raw_email(message.as_bytes())
    invoice_attachments = select_invoice_attachments(parsed.attachments)

    assert parsed.from_name == "Vendor Billing"
    assert parsed.from_email == "billing@example.com"
    assert parsed.subject == "Invoice INV-100"
    assert parsed.recipients == ("invoices@inbound.example.com",)
    assert len(invoice_attachments) == 1
    assert invoice_attachments[0].file_name == "invoice.pdf"
    assert invoice_attachments[0].content_type == "application/pdf"
    assert invoice_attachments[0].asset_type == AssetType.PDF


def test_select_invoice_attachments_skips_inline_logo_and_keeps_attachment_image() -> None:
    message = EmailMessage()
    message["From"] = "Accounts <accounts@example.com>"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Invoice with logo"
    message.set_content("Invoice email")
    message.make_related()
    message.add_alternative("<html><body><img src='cid:logo' /></body></html>", subtype="html")
    message.get_payload()[1].add_related(
        b"logo-bytes",
        maintype="image",
        subtype="png",
        cid="<logo>",
        filename="logo.png",
        disposition="inline",
    )
    message.add_attachment(
        b"invoice-image",
        maintype="image",
        subtype="png",
        filename="invoice-page.png",
    )

    parsed = parse_raw_email(message.as_bytes())
    invoice_attachments = select_invoice_attachments(parsed.attachments)

    assert [attachment.file_name for attachment in invoice_attachments] == [
        "invoice-page.png"
    ]
    assert invoice_attachments[0].asset_type == AssetType.DOCUMENT


def test_select_invoice_attachments_normalizes_octet_stream_by_filename() -> None:
    message = EmailMessage()
    message["From"] = "Accounts <accounts@example.com>"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Invoice"
    message.set_content("Invoice email")
    message.add_attachment(
        b"%PDF-1.7",
        maintype="application",
        subtype="octet-stream",
        filename="statement.pdf",
    )

    parsed = parse_raw_email(message.as_bytes())
    invoice_attachments = select_invoice_attachments(parsed.attachments)

    assert len(invoice_attachments) == 1
    assert invoice_attachments[0].content_type == "application/pdf"
    assert invoice_attachments[0].asset_type == AssetType.PDF


def test_parse_raw_email_extracts_plain_body_text() -> None:
    message = EmailMessage()
    message["From"] = "Vendor <billing@example.com>"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Your invoice"
    message.set_content(
        "Invoice INV-200\nAmount due: 199.00 USD\nPayment terms: net 30.\nThanks."
    )

    parsed = parse_raw_email(message.as_bytes())

    assert parsed.body_text is not None
    assert "INV-200" in parsed.body_text
    assert "199.00" in parsed.body_text


def test_parse_raw_email_prefers_substantial_html_over_short_plain() -> None:
    message = EmailMessage()
    message["From"] = "Vendor <billing@example.com>"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Invoice"
    message.set_content("See below.")
    message.add_alternative(
        "<html><body><p>Invoice INV-888</p>"
        "<p>Subtotal 100.00 USD</p><p>Tax 0</p><p>Total 100.00 USD</p>"
        "<p>Thank you for your business.</p></body></html>",
        subtype="html",
    )

    parsed = parse_raw_email(message.as_bytes())

    assert parsed.body_text is not None
    assert "INV-888" in parsed.body_text
    assert "100.00" in parsed.body_text


def test_parse_raw_email_extracts_visible_text_from_html_body() -> None:
    message = EmailMessage()
    message["From"] = "Vendor <billing@example.com>"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Invoice"
    message.set_content(
        "<html><body><p>Invoice <b>INV-H</b></p><p>Total 50.00 USD</p></body></html>",
        subtype="html",
        charset="utf-8",
    )

    parsed = parse_raw_email(message.as_bytes())

    assert parsed.body_text is not None
    assert "INV-H" in parsed.body_text
    assert "50.00" in parsed.body_text


def test_invoice_attachments_for_ingest_uses_body_when_no_files() -> None:
    message = EmailMessage()
    message["From"] = "a@b.com"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "Bill"
    message.set_content(
        "Invoice number 77\nSubtotal 100.00\nTax 0\nTotal 100.00 USD\nRegards."
    )
    parsed = parse_raw_email(message.as_bytes())
    attachments = invoice_attachments_for_ingest(parsed)

    assert len(attachments) == 1
    assert attachments[0].file_name == EMAIL_INVOICE_BODY_FILE_NAME
    assert attachments[0].content_type == "text/plain"
    assert attachments[0].asset_type == AssetType.DOCUMENT
    assert b"Invoice number 77" in attachments[0].data


def test_invoice_attachments_for_ingest_prefers_file_attachments() -> None:
    message = EmailMessage()
    message["From"] = "a@b.com"
    message["To"] = "invoices@inbound.example.com"
    message["Subject"] = "x"
    message.set_content("Body text that would also qualify alone.")
    message.add_attachment(
        b"%PDF-1.7",
        maintype="application",
        subtype="pdf",
        filename="invoice.pdf",
    )
    parsed = parse_raw_email(message.as_bytes())
    attachments = invoice_attachments_for_ingest(parsed)

    assert len(attachments) == 1
    assert attachments[0].file_name == "invoice.pdf"
