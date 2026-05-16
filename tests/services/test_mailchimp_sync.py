from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch


from app.db.models.enums import MailchimpSyncStatus
from app.services.mailchimp import MailchimpApiError
from app.services.mailchimp_sync import (
    remove_contact_from_mailchimp,
    upsert_contact_to_mailchimp,
)


def test_upsert_skips_unsubscribed(monkeypatch: Any) -> None:
    called: list[Any] = []

    def _no_mc(**_kwargs: Any) -> dict[str, Any]:
        called.append(True)
        return {}

    monkeypatch.setattr(
        "app.services.mailchimp_sync.add_subscriber_with_tag",
        _no_mc,
    )
    log = MagicMock()
    contact = SimpleNamespace(
        email="a@example.com",
        first_name="Ann",
        archived_at=None,
        mailchimp_status=MailchimpSyncStatus.UNSUBSCRIBED,
        mailchimp_subscriber_id=None,
    )
    outcome, status = upsert_contact_to_mailchimp(
        contact=contact,
        tag_name="crm-tag",
        logger=log,
    )
    assert outcome == "skipped"
    assert status is None
    assert called == []


def test_upsert_skips_archived(monkeypatch: Any) -> None:
    called: list[Any] = []

    def _no_mc(**_kwargs: Any) -> dict[str, Any]:
        called.append(True)
        return {}

    monkeypatch.setattr(
        "app.services.mailchimp_sync.add_subscriber_with_tag",
        _no_mc,
    )
    log = MagicMock()
    contact = SimpleNamespace(
        email="a@example.com",
        first_name="Ann",
        archived_at=SimpleNamespace(),
        mailchimp_status=MailchimpSyncStatus.PENDING,
        mailchimp_subscriber_id=None,
    )
    outcome, _ = upsert_contact_to_mailchimp(
        contact=contact,
        tag_name="crm-tag",
        logger=log,
    )
    assert outcome == "skipped"
    assert called == []


def test_upsert_synced_updates_contact(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        "app.services.mailchimp_sync.run_with_retry",
        lambda op, *args, **kwargs: op(*args, **kwargs),
    )
    monkeypatch.setattr(
        "app.services.mailchimp_sync.add_subscriber_with_tag",
        lambda **_: {"id": "sub-99"},
    )
    log = MagicMock()
    contact = SimpleNamespace(
        email="a@example.com",
        first_name="Ann",
        archived_at=None,
        mailchimp_status=MailchimpSyncStatus.PENDING,
        mailchimp_subscriber_id=None,
    )
    outcome, err = upsert_contact_to_mailchimp(
        contact=contact,
        tag_name="crm-tag",
        logger=log,
    )
    assert outcome == "synced"
    assert err is None
    assert contact.mailchimp_status == MailchimpSyncStatus.SYNCED
    assert contact.mailchimp_subscriber_id == "sub-99"


def test_upsert_failed_sets_status(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        "app.services.mailchimp_sync.run_with_retry",
        lambda *_a, **_k: (_ for _ in ()).throw(MailchimpApiError(500, "err")),
    )
    log = MagicMock()
    contact = SimpleNamespace(
        email="a@example.com",
        first_name="Ann",
        archived_at=None,
        mailchimp_status=MailchimpSyncStatus.PENDING,
        mailchimp_subscriber_id=None,
    )
    outcome, err = upsert_contact_to_mailchimp(
        contact=contact,
        tag_name="crm-tag",
        logger=log,
    )
    assert outcome == "failed"
    assert err == 500
    assert contact.mailchimp_status == MailchimpSyncStatus.FAILED


def test_remove_calls_archive(monkeypatch: Any) -> None:
    with patch(
        "app.services.mailchimp_sync.archive_subscriber",
        return_value=True,
    ) as arch:
        log = MagicMock()
        outcome = remove_contact_from_mailchimp(
            email="User@Example.com",
            logger=log,
        )
    assert outcome == "removed"
    arch.assert_called_once_with(email="user@example.com")


def test_remove_skips_blank_email() -> None:
    log = MagicMock()
    assert remove_contact_from_mailchimp(email="  ", logger=log) == "skipped"
