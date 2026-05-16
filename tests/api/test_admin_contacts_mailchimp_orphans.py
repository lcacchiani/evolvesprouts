from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import admin_contacts_mailchimp_sync as mcm
from app.db.models.enums import MailchimpSyncStatus


def test_orphan_dry_run_no_archive_calls(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    members = [
        {"email_address": "orphan@example.com", "status": "subscribed"},
    ]
    monkeypatch.setattr(
        mcm,
        "iter_audience_members",
        lambda **kwargs: iter(members),
    )

    called: list[Any] = []

    def _no_remove(**_kwargs: Any) -> Any:
        called.append(True)
        return "removed"

    monkeypatch.setattr(mcm, "remove_contact_from_mailchimp", _no_remove)

    class _FakeSession:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def __enter__(self) -> "_FakeSession":
            return self

        def __exit__(self, *_a: Any) -> None:
            return None

        def execute(self, *_a: Any, **_k: Any) -> Any:
            return MagicMock()

        def commit(self) -> None:
            return None

        def rollback(self) -> None:
            return None

    class _FakeRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def find_by_email(self, _email: str) -> Any:
            return None

    monkeypatch.setattr(mcm, "Session", _FakeSession)
    monkeypatch.setattr(mcm, "get_engine", lambda: object())
    monkeypatch.setattr(mcm, "ContactRepository", _FakeRepo)

    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-orphans",
        body=json.dumps({"dry_run": True, "max_members": 200}),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_orphan_cleanup(event, actor_sub="sub")
    assert resp["statusCode"] == 200
    assert called == []
    body = json.loads(resp["body"])
    assert body["dry_run"] is True
    assert body["removed"] >= 1


def test_orphan_next_offset_when_full_page(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    members = [{"email_address": f"u{i}@example.com", "status": "subscribed"} for i in range(3)]
    monkeypatch.setattr(
        mcm,
        "iter_audience_members",
        lambda **kwargs: iter(members),
    )

    class _FakeSession:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def __enter__(self) -> "_FakeSession":
            return self

        def __exit__(self, *_a: Any) -> None:
            return None

        def execute(self, *_a: Any, **_k: Any) -> Any:
            return MagicMock()

        def commit(self) -> None:
            return None

        def rollback(self) -> None:
            return None

    class _FakeRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def find_by_email(self, email: str) -> Any:
            c = MagicMock()
            c.archived_at = None
            c.mailchimp_status = MailchimpSyncStatus.SYNCED
            c.mailchimp_subscriber_id = "x"
            return c

    monkeypatch.setattr(mcm, "Session", _FakeSession)
    monkeypatch.setattr(mcm, "get_engine", lambda: object())
    monkeypatch.setattr(mcm, "ContactRepository", _FakeRepo)

    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-orphans",
        body=json.dumps({"dry_run": True, "max_members": 3, "mailchimp_offset": 0}),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_orphan_cleanup(event, actor_sub="sub")
    body = json.loads(resp["body"])
    assert body["scanned"] == 3
    assert body["next_offset"] == 3
