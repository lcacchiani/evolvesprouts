from __future__ import annotations

import base64
from typing import Any
from unittest.mock import MagicMock

from app.api.public_legacy_confirmation import send_booking_confirmation_email
from app.utils.fps_qr_png import decode_fps_qr_png_data_url

# 1×1 PNG (valid magic).
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_TINY_PNG_DATA_URL = f"data:image/png;base64,{_TINY_PNG_B64}"


def test_decode_fps_qr_png_data_url_accepts_booking_modal_shape() -> None:
    out = decode_fps_qr_png_data_url(_TINY_PNG_DATA_URL)
    assert out is not None
    assert out.startswith(b"\x89PNG\r\n\x1a\n")


def test_decode_fps_qr_png_data_url_rejects_non_png_prefix() -> None:
    assert decode_fps_qr_png_data_url("data:image/jpeg;base64,AAAA") is None


def test_decode_fps_qr_png_data_url_rejects_invalid_base64() -> None:
    assert decode_fps_qr_png_data_url("data:image/png;base64,@@@") is None


def test_decode_fps_qr_png_data_url_rejects_oversized() -> None:
    huge = "data:image/png;base64," + ("A" * 100_000)
    assert decode_fps_qr_png_data_url(huge) is None


def test_send_booking_confirmation_uses_mime_with_valid_fps_qr(
    monkeypatch: Any,
) -> None:
    templated = MagicMock()
    mime = MagicMock()
    monkeypatch.setenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "hello@example.com")
    monkeypatch.setattr(
        "app.api.public_legacy_confirmation.send_templated_email",
        templated,
    )
    monkeypatch.setattr(
        "app.api.public_legacy_confirmation.send_mime_email_with_inline_png",
        mime,
    )

    send_booking_confirmation_email(
        to_email="u@example.com",
        full_name="Jane",
        course_label="Course",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method="fps_qr",
        total_amount="HK$1.00",
        is_pending_payment=True,
        locale="en",
        fps_qr_image_data_url=_TINY_PNG_DATA_URL,
    )

    mime.assert_called_once()
    kwargs = mime.call_args.kwargs
    assert kwargs["inline_image_cid"] == "fps_qr"
    assert kwargs["png_bytes"] == base64.b64decode(_TINY_PNG_B64)
    assert "cid:fps_qr" in kwargs["body_html"]
    templated.assert_not_called()


def test_send_booking_confirmation_ignores_fps_qr_when_not_pending(
    monkeypatch: Any,
) -> None:
    templated = MagicMock()
    mime = MagicMock()
    monkeypatch.setenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "hello@example.com")
    monkeypatch.setattr(
        "app.api.public_legacy_confirmation.send_templated_email",
        templated,
    )
    monkeypatch.setattr(
        "app.api.public_legacy_confirmation.send_mime_email_with_inline_png",
        mime,
    )

    send_booking_confirmation_email(
        to_email="u@example.com",
        full_name="Jane",
        course_label="Course",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method="fps_qr",
        total_amount="HK$1.00",
        is_pending_payment=False,
        locale="en",
        fps_qr_image_data_url=_TINY_PNG_DATA_URL,
    )

    templated.assert_called_once()
    mime.assert_not_called()
    merged = templated.call_args.kwargs["template_data"]
    assert merged.get("include_fps_instructions") is False


def test_send_booking_confirmation_falls_back_when_fps_qr_invalid(
    monkeypatch: Any,
) -> None:
    templated = MagicMock()
    mime = MagicMock()
    monkeypatch.setenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "hello@example.com")
    monkeypatch.setattr(
        "app.api.public_legacy_confirmation.send_templated_email",
        templated,
    )
    monkeypatch.setattr(
        "app.api.public_legacy_confirmation.send_mime_email_with_inline_png",
        mime,
    )

    send_booking_confirmation_email(
        to_email="u@example.com",
        full_name="Jane",
        course_label="Course",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method="fps_qr",
        total_amount="HK$1.00",
        is_pending_payment=True,
        locale="en",
        fps_qr_image_data_url="data:image/png;base64,not-valid-base64!!!",
    )

    templated.assert_called_once()
    mime.assert_not_called()
    merged = templated.call_args.kwargs["template_data"]
    assert merged.get("include_fps_instructions") is True
    assert merged.get("payment_method") == "FPS"
