from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from app.api.public_form_hooks import (
    first_name_from_full_name,
    normalize_body_locale,
    resolve_contact_confirmation_locale,
    resolve_email_locale_from_accept_language,
)


def test_resolve_email_locale_from_accept_language() -> None:
    assert resolve_email_locale_from_accept_language("en-US,en;q=0.9") == "en"
    assert resolve_email_locale_from_accept_language("zh-CN,en;q=0.8") == "zh-CN"
    assert resolve_email_locale_from_accept_language("zh-HK") == "zh-HK"
    assert resolve_email_locale_from_accept_language("zh-TW,en;q=0.5") == "zh-HK"
    assert resolve_email_locale_from_accept_language("") == "en"


def test_normalize_body_locale() -> None:
    assert normalize_body_locale("zh-CN") == "zh-CN"
    assert normalize_body_locale("xx") == "en"


def test_first_name_from_full_name() -> None:
    assert first_name_from_full_name("Jane Smith") == "Jane"
    assert first_name_from_full_name("Single") == "Single"
    assert first_name_from_full_name("  Pat  Lee  ") == "Pat"


def test_resolve_contact_confirmation_locale_prefers_body() -> None:
    payload = {"locale": "zh-CN"}
    assert (
        resolve_contact_confirmation_locale(
            payload=payload,
            accept_language_header="en-US,en;q=0.9",
        )
        == "zh-CN"
    )


def test_resolve_contact_confirmation_locale_falls_back_to_accept_language() -> None:
    payload = {"locale": "invalid"}
    assert (
        resolve_contact_confirmation_locale(
            payload=payload,
            accept_language_header="zh-HK",
        )
        == "zh-HK"
    )


def test_run_reservation_post_success_hooks_sets_pending_without_stripe(
    monkeypatch: Any,
) -> None:
    from decimal import Decimal

    from app.api import public_reservations as pr

    captured: dict[str, object] = {}

    def _fake_send(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "hello@example.com")
    monkeypatch.setattr(
        "app.api.public_reservations.send_booking_confirmation_email",
        _fake_send,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.maybe_subscribe_booking_marketing",
        MagicMock(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.send_sales_form_recap_email",
        MagicMock(),
    )

    pr._run_reservation_post_success_hooks(
        {
            "attendee_email": "j@example.com",
            "attendee_name": "Jane Doe",
            "child_age_group": "3",
            "payment_method": "fps_qr",
            "total_amount": Decimal("15234.50"),
            "course_label": "Course",
            "locale": "en",
            "stripe_payment_intent_id": None,
        }
    )

    assert captured["is_pending_payment"] is True
    assert captured["total_amount"] == "HK$15,234.50"
