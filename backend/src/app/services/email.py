"""SES email sending helpers."""

from __future__ import annotations

import json
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


def send_email(
    *,
    source: str,
    to_addresses: Iterable[str],
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> None:
    """Send a plain or HTML email via SES."""
    message: dict[str, Any] = {
        "Subject": {"Data": subject, "Charset": "UTF-8"},
        "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
    }
    if body_html:
        message["Body"]["Html"] = {"Data": body_html, "Charset": "UTF-8"}

    get_ses_client().send_email(
        Source=source,
        Destination={"ToAddresses": list(to_addresses)},
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
    get_ses_client().send_templated_email(
        Source=source,
        Destination={"ToAddresses": list(to_addresses)},
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
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_text, "plain", "utf-8"))
    alt.attach(MIMEText(body_html, "html", "utf-8"))

    file_parts = list(attachments or [])

    if png_bytes:
        related = MIMEMultipart("related")
        related.attach(alt)
        image = MIMEImage(png_bytes, _subtype="png")
        cid = (inline_image_cid or "inline").strip()
        image.add_header("Content-ID", f"<{cid}>")
        image.add_header("Content-Disposition", "inline", filename=inline_filename)
        related.attach(image)
        body_root: MIMEMultipart = related
    else:
        body_root = alt

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
