from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from urllib.parse import urlencode

from app.api.public_mailchimp_webhook import handle_mailchimp_webhook
from app.db.models.enums import MailchimpSyncStatus


def test_mailchimp_webhook_rejects_non_post(api_gateway_event: Any) -> None:
    event = api_gateway_event(method="GET", path="/v1/mailchimp/webhook")

    response = handle_mailchimp_webhook(event, "GET")

    assert response["statusCode"] == 405


def test_mailchimp_webhook_rejects_invalid_secret(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/mailchimp/webhook",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        query_params={"token": "wrong-secret"},
        body=urlencode({"type": "unsubscribe", "data[email]": "ida@example.com"}),
    )
    monkeypatch.setenv("MAILCHIMP_WEBHOOK_SECRET", "correct-secret")

    response = handle_mailchimp_webhook(event, "POST")

    assert response["statusCode"] == 401


def test_mailchimp_webhook_updates_contact_status(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    contact = SimpleNamespace(
        email="ida@example.com",
        mailchimp_status=MailchimpSyncStatus.PENDING,
        mailchimp_subscriber_id=None,
    )
    contacts = {"ida@example.com": contact}
    _patch_contact_lookup(monkeypatch, contacts)
    monkeypatch.setenv("MAILCHIMP_WEBHOOK_SECRET", "correct-secret")

    event = api_gateway_event(
        method="POST",
        path="/v1/mailchimp/webhook",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        query_params={"token": "correct-secret"},
        body=urlencode(
            {
                "type": "unsubscribe",
                "data[email]": "ida@example.com",
                "data[id]": "mailchimp-subscriber-id",
            }
        ),
    )

    response = handle_mailchimp_webhook(event, "POST")

    assert response["statusCode"] == 200
    assert contact.mailchimp_status == MailchimpSyncStatus.UNSUBSCRIBED
    assert contact.mailchimp_subscriber_id == "mailchimp-subscriber-id"


def test_mailchimp_webhook_ignores_missing_contact(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    _patch_contact_lookup(monkeypatch, {})
    monkeypatch.setenv("MAILCHIMP_WEBHOOK_SECRET", "correct-secret")

    event = api_gateway_event(
        method="POST",
        path="/v1/mailchimp/webhook",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        query_params={"token": "correct-secret"},
        body=urlencode({"type": "subscribe", "data[email]": "nobody@example.com"}),
    )

    response = handle_mailchimp_webhook(event, "POST")

    assert response["statusCode"] == 200


def test_mailchimp_webhook_upemail_falls_back_to_old_email(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    contact = SimpleNamespace(
        email="old@example.com",
        mailchimp_status=MailchimpSyncStatus.PENDING,
        mailchimp_subscriber_id=None,
    )
    contacts = {"old@example.com": contact}
    _patch_contact_lookup(monkeypatch, contacts)
    monkeypatch.setenv("MAILCHIMP_WEBHOOK_SECRET", "correct-secret")

    event = api_gateway_event(
        method="POST",
        path="/v1/mailchimp/webhook",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        query_params={"token": "correct-secret"},
        body=urlencode(
            {
                "type": "upemail",
                "data[old_email]": "old@example.com",
                "data[new_email]": "new@example.com",
            }
        ),
    )

    response = handle_mailchimp_webhook(event, "POST")

    assert response["statusCode"] == 200
    assert contact.email == "new@example.com"
    assert contact.mailchimp_status == MailchimpSyncStatus.SYNCED


def _patch_contact_lookup(
    monkeypatch: Any,
    contacts_by_email: dict[str, Any],
) -> None:
    class _FakeSession:
        def __enter__(self) -> _FakeSession:
            return self

        def __exit__(self, *_args: Any) -> bool:
            return False

        def commit(self) -> None:
            return None

    class _FakeContactRepository:
        def __init__(self, _session: Any):
            self._contacts = contacts_by_email

        def find_by_email(self, email: str) -> Any:
            normalized = email.lower()
            for contact in self._contacts.values():
                if str(getattr(contact, "email", "")).lower() == normalized:
                    return contact
            return None

    monkeypatch.setattr("app.api.public_mailchimp_webhook.Session", lambda _engine: _FakeSession())
    monkeypatch.setattr("app.api.public_mailchimp_webhook.get_engine", lambda: object())
    monkeypatch.setattr(
        "app.api.public_mailchimp_webhook.ContactRepository",
        _FakeContactRepository,
    )
