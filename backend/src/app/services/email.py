"""SES email sending helpers."""

from __future__ import annotations

import json
from email import policy
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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
