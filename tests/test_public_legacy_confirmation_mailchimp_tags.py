from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import public_legacy_confirmation as plc


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


def test_run_contact_us_post_success_skips_confirmation_for_community_intent(
    monkeypatch: Any,
) -> None:
    calls: list[str] = []

    def _fake_send(**_kwargs: Any) -> None:
        calls.append("send")

    monkeypatch.setattr(plc, "send_contact_confirmation_email", _fake_send)
    monkeypatch.setattr(plc, "maybe_subscribe_contact_us_marketing", MagicMock())

    plc.run_contact_us_post_success(
        event={"headers": {}},
        payload={
            "email_address": "u@example.com",
            "first_name": "",
            "message": "Newsletter join",
            "signup_intent": "community_newsletter",
        },
    )

    assert calls == []
