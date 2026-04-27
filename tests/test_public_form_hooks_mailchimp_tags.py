from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import public_form_hooks as plc


def test_mailchimp_tag_for_contact_signup_intent() -> None:
    assert plc.mailchimp_tag_for_contact_signup_intent(None) == plc.TAG_PUBLIC_WWW_CONTACT_INQUIRY
    assert (
        plc.mailchimp_tag_for_contact_signup_intent("contact_inquiry")
        == plc.TAG_PUBLIC_WWW_CONTACT_INQUIRY
    )
    assert (
        plc.mailchimp_tag_for_contact_signup_intent("community_newsletter")
        == plc.TAG_PUBLIC_WWW_COMMUNITY_NEWSLETTER
    )
    assert (
        plc.mailchimp_tag_for_contact_signup_intent("event_notification")
        == plc.TAG_PUBLIC_WWW_EVENT_NOTIFICATION
    )


def test_mailchimp_booking_tag_from_payload() -> None:
    assert (
        plc.mailchimp_booking_tag_from_payload({"service_key": "My Service!"})
        == "public-www-booking-customer-my-service"
    )
    assert (
        plc.mailchimp_booking_tag_from_payload({"course_slug": "mba-0-1"})
        == "public-www-booking-customer-mba-0-1"
    )
    assert (
        plc.mailchimp_booking_tag_from_payload(
            {"service_key": "primary", "course_slug": "ignored"}
        )
        == "public-www-booking-customer-primary"
    )
    assert plc.mailchimp_booking_tag_from_payload({}) == "public-www-booking-customer-unknown"
    assert (
        plc.mailchimp_booking_tag_from_payload({"serviceKey": "From Camel"})
        == "public-www-booking-customer-from-camel"
    )
    assert (
        plc.mailchimp_booking_tag_from_payload({"courseSlug": "mba-track"})
        == "public-www-booking-customer-mba-track"
    )


@pytest.mark.parametrize(
    ("signup_intent", "expected_tag"),
    [
        ("community_newsletter", plc.TAG_PUBLIC_WWW_COMMUNITY_NEWSLETTER),
        ("event_notification", plc.TAG_PUBLIC_WWW_EVENT_NOTIFICATION),
        ("contact_inquiry", plc.TAG_PUBLIC_WWW_CONTACT_INQUIRY),
    ],
)
def test_run_contact_us_post_success_routes_marketing_tag(
    monkeypatch: Any,
    signup_intent: str,
    expected_tag: str,
) -> None:
    captured: dict[str, Any] = {}

    def _fake_maybe_subscribe(**kwargs: Any) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(plc, "maybe_subscribe_contact_us_marketing", _fake_maybe_subscribe)
    monkeypatch.setattr(plc, "send_contact_confirmation_email", MagicMock())
    monkeypatch.setattr(plc, "send_sales_form_recap_email", MagicMock())
    support_mock = MagicMock()
    monkeypatch.setattr(plc, "send_contact_inquiry_support_email", support_mock)

    plc.run_contact_us_post_success(
        event={"headers": {}},
        payload={
            "email_address": "u@example.com",
            "first_name": "Pat",
            "message": "hi",
            "signup_intent": signup_intent,
            "marketing_opt_in": True,
        },
    )

    assert captured.get("tag_name") == expected_tag
    if signup_intent == "contact_inquiry":
        support_mock.assert_called_once()
    else:
        support_mock.assert_not_called()


def test_run_contact_us_post_success_skips_confirmation_for_community_intent(
    monkeypatch: Any,
) -> None:
    calls: list[str] = []

    def _fake_send(**_kwargs: Any) -> None:
        calls.append("send")

    monkeypatch.setattr(plc, "send_contact_confirmation_email", _fake_send)
    monkeypatch.setattr(plc, "maybe_subscribe_contact_us_marketing", MagicMock())
    monkeypatch.setattr(plc, "send_sales_form_recap_email", MagicMock())
    monkeypatch.setattr(plc, "send_contact_inquiry_support_email", MagicMock())

    plc.run_contact_us_post_success(
        event={"headers": {}},
        payload={
            "email_address": "u@example.com",
            "first_name": "",
            "message": "Newsletter join",
            "signup_intent": "community_newsletter",
            "marketing_opt_in": True,
        },
    )

    assert calls == []


def test_run_reservation_post_success_hooks_passes_dynamic_tag_to_booking_marketing(
    monkeypatch: Any,
) -> None:
    from decimal import Decimal

    from app.api import public_reservations as pr

    captured: dict[str, Any] = {}

    def _fake_maybe_subscribe(**kwargs: Any) -> None:
        captured.update(kwargs)

    monkeypatch.setenv("CONFIRMATION_EMAIL_FROM_ADDRESS", "hello@example.com")
    monkeypatch.setattr(
        "app.api.public_reservations.send_booking_confirmation_email",
        MagicMock(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.maybe_subscribe_booking_marketing",
        _fake_maybe_subscribe,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.send_sales_form_recap_email",
        MagicMock(),
    )

    pr._run_reservation_post_success_hooks(
        {
            "attendee_email": "j@example.com",
            "attendee_name": "Jane Doe",
            "service_tier": "3",
            "payment_method": "fps_qr",
            "total_amount": Decimal("150"),
            "course_label": "Course",
            "locale": "en",
            "marketing_opt_in": True,
            "service_key": "easter-workshop",
            "course_slug": "event-booking",
            "stripe_payment_intent_id": None,
        }
    )

    assert captured.get("tag_name") == "public-www-booking-customer-easter-workshop"
