"""Parsing helpers for raw inbound email payloads."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime, parseaddr
import mimetypes
from pathlib import Path

from app.db.models import AssetType

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

    return ParsedInboundEmail(
        from_name=from_name,
        from_email=from_email,
        recipients=recipients,
        subject=subject,
        sent_at=sent_at,
        attachments=tuple(attachments),
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
