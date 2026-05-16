from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app.api import admin_contacts_mailchimp_sync as mcm
from app.db.models.enums import MailchimpSyncStatus
from app.exceptions import ValidationError


@pytest.fixture
def production_mailchimp_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")


def _identity_event(api_gateway_event: Any, admin_identity: dict[str, str]) -> dict[str, Any]:
    return api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps(
            {
                "tag_name": "crm-bulk",
                "max_contacts": 50,
                "dry_run": False,
            }
        ),
        authorizer_context=admin_identity,
    )


def test_sync_run_409_not_production(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "staging")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")
    event = _identity_event(api_gateway_event, admin_identity)
    resp = mcm.run_mailchimp_sync_batch(event, actor_sub="sub")
    assert resp["statusCode"] == 409


def test_sync_run_409_missing_list_id(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    monkeypatch.setenv("DEPLOYMENT_STAGE", "production")
    monkeypatch.delenv("MAILCHIMP_LIST_ID", raising=False)
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")
    event = _identity_event(api_gateway_event, admin_identity)
    resp = mcm.run_mailchimp_sync_batch(event, actor_sub="sub")
    assert resp["statusCode"] == 409


def test_sync_run_400_missing_tag_name(
    production_mailchimp_env: None,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps({"max_contacts": 10}),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="tag_name"):
        mcm.run_mailchimp_sync_batch(event, actor_sub="sub")


def test_sync_run_400_unsubscribed_in_only_statuses(
    production_mailchimp_env: None,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps(
            {
                "tag_name": "crm-bulk",
                "only_statuses": ["unsubscribed"],
            }
        ),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="unsubscribed"):
        mcm.run_mailchimp_sync_batch(event, actor_sub="sub")


def test_sync_run_dry_run_skips_mailchimp(
    production_mailchimp_env: None,
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    called: list[Any] = []

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

        def list_for_mailchimp_sync(
            self, *, limit: int, cursor: UUID | None, statuses: list[MailchimpSyncStatus]
        ) -> list[Any]:
            c = MagicMock()
            c.id = uuid4()
            c.email = "a@example.com"
            c.first_name = "A"
            c.archived_at = None
            c.mailchimp_status = MailchimpSyncStatus.PENDING
            return [c]

    monkeypatch.setattr(mcm, "Session", _FakeSession)
    monkeypatch.setattr(mcm, "get_engine", lambda: object())
    monkeypatch.setattr(mcm, "ContactRepository", _FakeRepo)

    def _no_upsert(**_kwargs: Any) -> tuple[str, int | None]:
        called.append(True)
        return "synced", None

    monkeypatch.setattr(mcm, "upsert_contact_to_mailchimp", _no_upsert)

    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps({"tag_name": "crm-bulk", "dry_run": True}),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_sync_batch(event, actor_sub="sub")
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["dry_run"] is True
    assert body["processed"] == 1
    assert body["would_process"] == 1
    assert called == []


def test_sync_run_400_synced_in_only_statuses(
    production_mailchimp_env: None,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps(
            {
                "tag_name": "crm-bulk",
                "only_statuses": ["synced"],
            }
        ),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError, match="synced"):
        mcm.run_mailchimp_sync_batch(event, actor_sub="sub")


def test_sync_run_accepts_tag_name_with_dot_and_underscore(
    production_mailchimp_env: None,
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
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

        def list_for_mailchimp_sync(
            self, *, limit: int, cursor: UUID | None, statuses: list[MailchimpSyncStatus]
        ) -> list[Any]:
            return []

    monkeypatch.setattr(mcm, "Session", _FakeSession)
    monkeypatch.setattr(mcm, "get_engine", lambda: object())
    monkeypatch.setattr(mcm, "ContactRepository", _FakeRepo)

    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps({"tag_name": "crm.bulk_sync", "dry_run": True}),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_sync_batch(event, actor_sub="sub")
    assert resp["statusCode"] == 200


def test_sync_run_errors_sample_includes_lead_email_masked(
    production_mailchimp_env: None,
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
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

        def list_for_mailchimp_sync(
            self, *, limit: int, cursor: UUID | None, statuses: list[MailchimpSyncStatus]
        ) -> list[Any]:
            c = MagicMock()
            c.id = uuid4()
            c.email = "operator-visible@example.com"
            c.first_name = "A"
            c.archived_at = None
            c.mailchimp_status = MailchimpSyncStatus.PENDING
            return [c]

    monkeypatch.setattr(mcm, "Session", _FakeSession)
    monkeypatch.setattr(mcm, "get_engine", lambda: object())
    monkeypatch.setattr(mcm, "ContactRepository", _FakeRepo)
    monkeypatch.setattr(
        mcm,
        "upsert_contact_to_mailchimp",
        lambda **_kwargs: ("failed", 503),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/admin/contacts/mailchimp-sync-run",
        body=json.dumps({"tag_name": "crm-bulk", "dry_run": False}),
        authorizer_context=admin_identity,
    )
    resp = mcm.run_mailchimp_sync_batch(event, actor_sub="sub")
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["failed"] == 1
    assert body["errors_sample"]
    sample = body["errors_sample"][0]
    assert "lead_email_masked" in sample
    assert sample["lead_email_masked"]
    assert sample["lead_email_masked"] != "operator-visible@example.com"
