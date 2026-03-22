"""Parsing helpers for raw inbound email payloads."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from email import policy
from email.message import Message
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime, parseaddr
from html.parser import HTMLParser
import mimetypes
import os
import re
from pathlib import Path

from app.db.models import AssetType

# Minimum visible characters in the email body to treat as invoice source material.
_MIN_INVOICE_BODY_CHARS = 25


def _max_invoice_body_bytes() -> int:
    raw = os.getenv("OPENROUTER_MAX_FILE_BYTES", "").strip()
    if not raw:
        return 15 * 1024 * 1024
    try:
        parsed = int(raw)
    except ValueError:
        return 15 * 1024 * 1024
    return max(1, parsed)


EMAIL_INVOICE_BODY_FILE_NAME = "email-invoice-body.txt"

_SUPPORTED_ATTACHMENT_TYPES: dict[str, AssetType] = {
    "application/pdf": AssetType.PDF,
    "image/jpeg": AssetType.DOCUMENT,
    "image/png": AssetType.DOCUMENT,
    "image/webp": AssetType.DOCUMENT,
}
_EXTENSION_CONTENT_TYPES = {
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".webp": "image/webp",
}


@dataclass(frozen=True)
class ParsedEmailAttachment:
    """Raw attachment extracted from a MIME email payload."""

    file_name: str
    content_type: str
    content_disposition: str | None
    content_id: str | None
    data: bytes


@dataclass(frozen=True)
class ParsedInboundEmail:
    """Normalized metadata and attachments from a raw email."""

    from_name: str | None
    from_email: str | None
    recipients: tuple[str, ...]
    subject: str | None
    sent_at: datetime | None
    attachments: tuple[ParsedEmailAttachment, ...]
    body_text: str | None


@dataclass(frozen=True)
class InvoiceAttachment:
    """Attachment eligible for invoice ingestion."""

    file_name: str
    content_type: str
    asset_type: AssetType
    data: bytes


def parse_raw_email(raw_email: bytes) -> ParsedInboundEmail:
    """Parse a raw RFC822 email payload into a structured object."""
    message = BytesParser(policy=policy.default).parsebytes(raw_email)
    from_name, from_email = _normalize_address(message.get("from"))
    recipients = tuple(
        address
        for _name, address in getaddresses(
            message.get_all("to", []) + message.get_all("cc", [])
        )
        if address
    )
    subject = _optional_text(message.get("subject"))
    sent_at = _parse_date_header(message.get("date"))

    attachments: list[ParsedEmailAttachment] = []
    for part in message.walk():
        if part.is_multipart():
            continue
        file_name = _optional_text(part.get_filename())
        if not file_name:
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        attachments.append(
            ParsedEmailAttachment(
                file_name=file_name,
                content_type=(part.get_content_type() or "application/octet-stream")
                .strip()
                .lower(),
                content_disposition=part.get_content_disposition(),
                content_id=_optional_text(part.get("content-id")),
                data=payload,
            )
        )

    body_text = _extract_body_text(message)

    return ParsedInboundEmail(
        from_name=from_name,
        from_email=from_email,
        recipients=recipients,
        subject=subject,
        sent_at=sent_at,
        attachments=tuple(attachments),
        body_text=body_text,
    )


def select_invoice_attachments(
    attachments: tuple[ParsedEmailAttachment, ...],
) -> list[InvoiceAttachment]:
    """Return supported invoice attachments while skipping inline email chrome."""
    selected: list[InvoiceAttachment] = []
    for attachment in attachments:
        normalized = _normalize_supported_attachment(
            attachment.file_name, attachment.content_type
        )
        if normalized is None:
            continue
        content_type, asset_type = normalized
        if (
            asset_type == AssetType.DOCUMENT
            and attachment.content_disposition == "inline"
        ):
            continue
        if asset_type == AssetType.DOCUMENT and attachment.content_id:
            continue
        selected.append(
            InvoiceAttachment(
                file_name=attachment.file_name,
                content_type=content_type,
                asset_type=asset_type,
                data=attachment.data,
            )
        )
    return selected


def invoice_attachments_for_ingest(
    parsed: ParsedInboundEmail,
) -> list[InvoiceAttachment]:
    """Return file attachments for invoice ingest, or a synthetic body text asset."""
    selected = select_invoice_attachments(parsed.attachments)
    if selected:
        return selected
    return synthetic_invoice_attachment_from_body(parsed)


def synthetic_invoice_attachment_from_body(
    parsed: ParsedInboundEmail,
) -> list[InvoiceAttachment]:
    """Build a text/plain pseudo-attachment when the invoice exists only in the body."""
    body = (parsed.body_text or "").strip()
    if len(body) < _MIN_INVOICE_BODY_CHARS:
        return []
    encoded = body.encode("utf-8")
    max_bytes = _max_invoice_body_bytes()
    if len(encoded) > max_bytes:
        encoded = encoded[:max_bytes]
    return [
        InvoiceAttachment(
            file_name=EMAIL_INVOICE_BODY_FILE_NAME,
            content_type="text/plain",
            asset_type=AssetType.DOCUMENT,
            data=encoded,
        )
    ]


def _normalize_supported_attachment(
    file_name: str,
    content_type: str,
) -> tuple[str, AssetType] | None:
    normalized_type = content_type.strip().lower()
    if normalized_type == "image/jpg":
        normalized_type = "image/jpeg"
    if normalized_type == "application/octet-stream":
        guessed = _guess_content_type(file_name)
        if guessed is not None:
            normalized_type = guessed
    asset_type = _SUPPORTED_ATTACHMENT_TYPES.get(normalized_type)
    if asset_type is None:
        guessed = _guess_content_type(file_name)
        if guessed is None:
            return None
        normalized_type = guessed
        asset_type = _SUPPORTED_ATTACHMENT_TYPES.get(normalized_type)
    if asset_type is None:
        return None
    return normalized_type, asset_type


def _guess_content_type(file_name: str) -> str | None:
    suffix = Path(file_name).suffix.lower()
    if suffix in _EXTENSION_CONTENT_TYPES:
        return _EXTENSION_CONTENT_TYPES[suffix]
    guessed, _encoding = mimetypes.guess_type(file_name)
    if guessed == "image/jpg":
        return "image/jpeg"
    return guessed.lower() if guessed else None


def _normalize_address(value: str | None) -> tuple[str | None, str | None]:
    name, email_address = parseaddr(value or "")
    return _optional_text(name), _optional_text(email_address)


def _parse_date_header(value: str | None) -> datetime | None:
    normalized = _optional_text(value)
    if not normalized:
        return None
    try:
        return parsedate_to_datetime(normalized)
    except (TypeError, ValueError, IndexError):
        return None


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


class _HTMLToText(HTMLParser):
    """Strip tags and scripts; keep visible text with rough line breaks."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self._skip_depth += 1
        elif tag in {"br", "p", "div", "tr", "li"}:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag in {"p", "div", "tr", "li"}:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self._parts.append(data)


def _strip_html_to_text(html: str) -> str:
    parser = _HTMLToText()
    parser.feed(html)
    parser.close()
    return "".join(parser._parts)


def _part_text_payload(part: Message) -> str | None:
    payload = part.get_payload(decode=True)
    if payload is None:
        return None
    if isinstance(payload, bytes):
        charset = part.get_content_charset() or "utf-8"
        try:
            return payload.decode(charset, errors="replace")
        except LookupError:
            return payload.decode("utf-8", errors="replace")
    return str(payload)


def _normalize_body_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _extract_body_text(message: Message) -> str | None:
    """Prefer text/plain; fall back to visible text from text/html."""
    get_body = getattr(message, "get_body", None)
    if callable(get_body):
        for prefer in (("plain",), ("html",)):
            part = get_body(preferencelist=prefer)
            if part is None:
                continue
            payload = _part_text_payload(part)
            if payload is None or not payload.strip():
                continue
            ctype = (part.get_content_type() or "").strip().lower()
            if ctype == "text/plain":
                normalized = _normalize_body_text(payload)
            elif ctype == "text/html":
                normalized = _normalize_body_text(_strip_html_to_text(payload))
            else:
                continue
            if normalized:
                return normalized
    return _extract_body_text_from_walk(message)


def _extract_body_text_from_walk(message: Message) -> str | None:
    plain_chunks: list[str] = []
    html_chunks: list[str] = []
    for part in message.walk():
        if part.is_multipart():
            continue
        if _optional_text(part.get_filename()):
            continue
        ctype = (part.get_content_type() or "").strip().lower()
        payload = _part_text_payload(part)
        if payload is None or not payload.strip():
            continue
        if ctype == "text/plain":
            plain_chunks.append(payload)
        elif ctype == "text/html":
            html_chunks.append(payload)
    if plain_chunks:
        return _normalize_body_text("\n\n".join(plain_chunks))
    if html_chunks:
        return _normalize_body_text(
            _strip_html_to_text("\n\n".join(html_chunks)),
        )
    return None
