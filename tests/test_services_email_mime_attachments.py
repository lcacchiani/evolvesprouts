from __future__ import annotations

import base64
from email import policy
from email.parser import BytesParser
from typing import Any

from app.services.email import send_mime_email_with_optional_attachments


def test_send_mime_email_with_optional_attachments_mixed_inline_png_and_ics(
    monkeypatch: Any,
) -> None:
    captured: dict[str, bytes] = {}

    class _FakeSes:
        def send_raw_email(self, **kwargs: object) -> None:
            captured["raw"] = kwargs["RawMessage"]["Data"]  # type: ignore[index]

    monkeypatch.setattr(
        "app.services.email.get_ses_client",
        lambda: _FakeSes(),
    )

    tiny_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    ics_body = b"BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n"

    send_mime_email_with_optional_attachments(
        source="hello@example.com",
        to_addresses=["you@example.com"],
        subject="Booking",
        body_text="plain",
        body_html="<p>html</p>",
        inline_image_cid="fps_qr",
        png_bytes=tiny_png,
        attachments=[
            (
                "evolvesprouts-booking.ics",
                "text/calendar; charset=utf-8; method=PUBLISH",
                ics_body,
            )
        ],
    )

    raw = captured.get("raw")
    assert raw is not None
    root = BytesParser(policy=policy.default).parsebytes(raw)
    assert root.is_multipart()
    assert root.get_content_subtype() == "mixed"
    mixed_children = root.get_payload()
    assert isinstance(mixed_children, list) and len(mixed_children) == 2
    related = mixed_children[0]
    assert related.get_content_subtype() == "related"
    ical = mixed_children[1]
    assert ical.get_content_type() == "text/calendar"
    assert ical.get_param("method") == "PUBLISH"
    assert ical.get_content_disposition() == "attachment"
    payload = ical.get_payload(decode=True)
    assert payload is not None
    assert b"BEGIN:VCALENDAR" in payload


def test_send_mime_email_with_optional_attachments_ics_only_no_png(
    monkeypatch: Any,
) -> None:
    captured: dict[str, bytes] = {}

    class _FakeSes:
        def send_raw_email(self, **kwargs: object) -> None:
            captured["raw"] = kwargs["RawMessage"]["Data"]  # type: ignore[index]

    monkeypatch.setattr(
        "app.services.email.get_ses_client",
        lambda: _FakeSes(),
    )
    ics_body = b"BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"

    send_mime_email_with_optional_attachments(
        source="hello@example.com",
        to_addresses=["you@example.com"],
        subject="S",
        body_text="t",
        body_html="<p>h</p>",
        png_bytes=None,
        attachments=[
            ("x.ics", "text/calendar; charset=utf-8; method=PUBLISH", ics_body)
        ],
    )

    raw = captured["raw"]
    root = BytesParser(policy=policy.default).parsebytes(raw)
    assert root.is_multipart()
    assert root.get_content_subtype() == "mixed"
    mixed_children = root.get_payload()
    assert isinstance(mixed_children, list) and len(mixed_children) == 2
    alt = mixed_children[0]
    assert alt.get_content_subtype() == "alternative"
    ical = mixed_children[1]
    assert ical.get_content_type() == "text/calendar"
