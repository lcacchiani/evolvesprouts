"""SES email sending helpers."""

from __future__ import annotations

import json
import os
from email import policy
from email.message import Message
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from typing import Any
from collections.abc import Iterable

from app.services.aws_clients import get_ses_client
from app.utils.deployment import is_production
from app.utils.logging import get_logger

logger = get_logger(__name__)

_STAGING_TEST_EMAIL_ENV = "STAGING_TEST_EMAIL_ADDRESS"
_BODY_PREVIEW_MAX = 2000


def _maybe_redirect_staging_recipients() -> list[str] | None:
    """If staging redirect is configured, return single-address list; else None."""
    redirect = os.getenv(_STAGING_TEST_EMAIL_ENV, "").strip()
    if not redirect:
        return None
    return [redirect]


def _log_staging_email_skip(
    *,
    kind: str,
    source: str,
    to_addresses: Iterable[str],
    subject: str | None = None,
    template_name: str | None = None,
    template_data: dict[str, Any] | None = None,
    body_text: str | None = None,
    body_html: str | None = None,
) -> None:
    to_list = list(to_addresses)
    preview = ""
    if body_text:
        preview = body_text[:_BODY_PREVIEW_MAX]
    elif body_html:
        preview = body_html[:_BODY_PREVIEW_MAX]
    elif template_data is not None:
        try:
            preview = json.dumps(template_data, default=str)[:_BODY_PREVIEW_MAX]
        except (TypeError, ValueError):
            preview = str(template_data)[:_BODY_PREVIEW_MAX]
    logger.info(
        "Staging email send skipped or redirected (no SES in non-production)",
        extra={
            "email_kind": kind,
            "from": source,
            "to": to_list,
            "subject": subject,
            "template": template_name,
            "body_preview": preview,
        },
    )


def send_email(
    *,
    source: str,
    to_addresses: Iterable[str],
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> None:
    """Send a plain or HTML email via SES."""
    to_list = list(to_addresses)
    if not is_production():
        redirected = _maybe_redirect_staging_recipients()
        if redirected is None:
            _log_staging_email_skip(
                kind="send_email",
                source=source,
                to_addresses=to_list,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
            )
            return
        to_list = redirected
    message: dict[str, Any] = {
        "Subject": {"Data": subject, "Charset": "UTF-8"},
        "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
    }
    if body_html:
        message["Body"]["Html"] = {"Data": body_html, "Charset": "UTF-8"}

    get_ses_client().send_email(
        Source=source,
        Destination={"ToAddresses": to_list},
        Message=message,
    )


def send_templated_email(
    *,
    source: str,
    to_addresses: Iterable[str],
    template_name: str,
    template_data: dict[str, Any],
) -> None:
    """Send a templated email via SES."""
    to_list = list(to_addresses)
    if not is_production():
        redirected = _maybe_redirect_staging_recipients()
        if redirected is None:
            _log_staging_email_skip(
                kind="send_templated_email",
                source=source,
                to_addresses=to_list,
                template_name=template_name,
                template_data=template_data,
            )
            return
        to_list = redirected
    get_ses_client().send_templated_email(
        Source=source,
        Destination={"ToAddresses": to_list},
        Template=template_name,
        TemplateData=json.dumps(template_data),
    )


def send_mime_email_with_inline_png(
    *,
    source: str,
    to_addresses: Iterable[str],
    subject: str,
    body_text: str,
    body_html: str,
    inline_image_cid: str,
    png_bytes: bytes,
    inline_filename: str = "fps-qr.png",
) -> None:
    """Send multipart/related HTML email with one inline PNG (referenced as cid:...)."""
    to_list = list(to_addresses)
    if not is_production():
        redirected = _maybe_redirect_staging_recipients()
        if redirected is None:
            _log_staging_email_skip(
                kind="send_mime_email_with_inline_png",
                source=source,
                to_addresses=to_list,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
            )
            return
        to_list = redirected
    root = MIMEMultipart("related", policy=policy.SMTP)
    root["Subject"] = subject
    root["From"] = source
    root["To"] = ", ".join(to_list)

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_text, "plain", "utf-8"))
    alt.attach(MIMEText(body_html, "html", "utf-8"))
    root.attach(alt)

    image = MIMEImage(png_bytes, _subtype="png")
    image.add_header("Content-ID", f"<{inline_image_cid}>")
    image.add_header("Content-Disposition", "inline", filename=inline_filename)
    root.attach(image)

    raw_bytes = root.as_bytes()
    get_ses_client().send_raw_email(
        Source=source,
        Destinations=to_list,
        RawMessage={"Data": raw_bytes},
    )


def send_mime_email_with_optional_attachments(
    *,
    source: str,
    to_addresses: Iterable[str],
    subject: str,
    body_text: str,
    body_html: str,
    inline_image_cid: str | None = None,
    png_bytes: bytes | None = None,
    inline_filename: str = "fps-qr.png",
    attachments: Iterable[tuple[str, str, bytes]] | None = None,
) -> None:
    """Send multipart email: optional inline PNG (cid) and optional file attachments."""
    to_list = list(to_addresses)
    if not is_production():
        redirected = _maybe_redirect_staging_recipients()
        if redirected is None:
            _log_staging_email_skip(
                kind="send_mime_email_with_optional_attachments",
                source=source,
                to_addresses=to_list,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
            )
            return
        to_list = redirected
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_text, "plain", "utf-8"))
    alt.attach(MIMEText(body_html, "html", "utf-8"))

    file_parts = list(attachments or [])

    body_root: Message
    if png_bytes:
        related = MIMEMultipart("related")
        related.attach(alt)
        image = MIMEImage(png_bytes, _subtype="png")
        cid = (inline_image_cid or "inline").strip()
        image.add_header("Content-ID", f"<{cid}>")
        image.add_header("Content-Disposition", "inline", filename=inline_filename)
        related.attach(image)
        body_root = related
    else:
        body_root = alt

    root: Message
    if file_parts:
        root = MIMEMultipart("mixed", policy=policy.SMTP)
        root["Subject"] = subject
        root["From"] = source
        root["To"] = ", ".join(to_list)
        root.attach(body_root)
        for filename, content_type, payload in file_parts:
            ct_lower = content_type.lower().strip()
            part: Message
            if ct_lower.startswith("text/calendar"):
                cal_part = MIMEText(
                    payload.decode("utf-8"),
                    "calendar",
                    "utf-8",
                )
                cal_part.set_param("method", "PUBLISH")
                cal_part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=filename,
                )
                part = cal_part
            else:
                maintype, _, subtype = content_type.partition("/")
                if not subtype:
                    maintype, subtype = "application", "octet-stream"
                bin_part = MIMEBase(maintype, subtype.split(";")[0].strip())
                bin_part.set_payload(payload)
                encoders.encode_base64(bin_part)
                bin_part.add_header(
                    "Content-Disposition", "attachment", filename=filename
                )
                bin_part.add_header("Content-Type", content_type)
                part = bin_part
            root.attach(part)
        raw_bytes = root.as_bytes()
    else:
        root = body_root
        root["Subject"] = subject
        root["From"] = source
        root["To"] = ", ".join(to_list)
        raw_bytes = root.as_bytes()

    get_ses_client().send_raw_email(
        Source=source,
        Destinations=to_list,
        RawMessage={"Data": raw_bytes},
    )
