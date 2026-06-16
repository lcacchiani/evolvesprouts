from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import admin_contacts_mailchimp_sync as mcm
from app.db.models.enums import MailchimpSyncStatus


def _fake_iter(members: list[dict[str, Any]]):
    def _iter(
        *,
        page_size: int,
        start_offset: int,
        single_page: bool,
        fields: tuple[str, ...],
    ):
        assert single_page is True
        assert isinstance(fields, tuple)
        return iter(members)

    return _iter


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
    monkeypatch.setattr(mcm, "iter_audience_members", _fake_iter(members))

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

        def __exit__(self, *_a: Any, **_k: Any) -> None:
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
    assert body["removed"] == 0
    assert body["would_remove"] >= 1


def test_orphan_next_offset_when_full_page(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    members = [
        {"email_address": f"u{i}@example.com", "status": "subscribed"} for i in range(3)
    ]
    monkeypatch.setattr(mcm, "iter_audience_members", _fake_iter(members))

    class _FakeSession:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def __enter__(self) -> "_FakeSession":
            return self

        def __exit__(self, *_a: Any, **_k: Any) -> None:
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


def test_orphan_permanent_next_offset_repeats_when_removed(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    members = [
        {"email_address": "gone@example.com", "status": "subscribed"},
    ]
    monkeypatch.setattr(mcm, "iter_audience_members", _fake_iter(members))

    monkeypatch.setattr(
        mcm,
        "remove_contact_from_mailchimp",
        lambda **kwargs: "removed",
    )

    class _FakeSession:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def __enter__(self) -> "_FakeSession":
            return self

        def __exit__(self, *_a: Any, **_k: Any) -> None:
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

    offset = 40
    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-orphans",
        body=json.dumps(
            {
                "dry_run": False,
                "mode": "permanent",
                "max_members": 50,
                "mailchimp_offset": offset,
            }
        ),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_orphan_cleanup(event, actor_sub="sub")
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["removed"] >= 1
    assert body["next_offset"] == offset


def test_orphan_archive_skips_already_archived_no_api(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    members = [
        {"email_address": "old@example.com", "status": "archived"},
    ]
    monkeypatch.setattr(mcm, "iter_audience_members", _fake_iter(members))

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

        def __exit__(self, *_a: Any, **_k: Any) -> None:
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
        body=json.dumps({"dry_run": False, "mode": "archive", "max_members": 10}),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_orphan_cleanup(event, actor_sub="sub")
    assert resp["statusCode"] == 200
    assert called == []
    body = json.loads(resp["body"])
    assert body["already_archived"] == 1
    assert body["removed"] == 0
