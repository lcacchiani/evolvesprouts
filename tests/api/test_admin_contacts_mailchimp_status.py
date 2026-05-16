from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import admin_contacts_mailchimp_sync as mcm


def test_mailchimp_sync_status_counts(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    class _FakeSession:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        def __enter__(self) -> "_FakeSession":
            return self

        def __exit__(self, *_a: Any) -> None:
            return None

        def execute(self, *_a: Any, **_k: Any) -> Any:
            return MagicMock()

    class _FakeRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def count_by_mailchimp_status(self) -> dict[Any, int]:
            from app.db.models.enums import MailchimpSyncStatus

            return {
                MailchimpSyncStatus.PENDING: 2,
                MailchimpSyncStatus.SYNCED: 3,
                MailchimpSyncStatus.FAILED: 0,
                MailchimpSyncStatus.UNSUBSCRIBED: 1,
            }

        def count_archived_with_mailchimp_record(self) -> int:
            return 4

    monkeypatch.setattr(mcm, "Session", _FakeSession)
    monkeypatch.setattr(mcm, "get_engine", lambda: object())
    monkeypatch.setattr(mcm, "ContactRepository", _FakeRepo)

    event = api_gateway_event(
        method="GET",
        path="/v1/admin/contacts/mailchimp-sync-status",
        authorizer_context=admin_identity,
    )
    resp = mcm.get_mailchimp_sync_summary(event)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["counts_by_status"]["pending"] == 2
    assert body["counts_by_status"]["synced"] == 3
    assert body["archived_with_mailchimp_record"] == 4
    assert body["last_run_summary"] is None
