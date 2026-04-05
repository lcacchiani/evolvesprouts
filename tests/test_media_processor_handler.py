from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest
from app.db.models.enums import MailchimpSyncStatus


def _load_handler_module() -> Any:
    module_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "lambda"
        / "media_processor"
        / "handler.py"
    )
    spec = importlib.util.spec_from_file_location(
        "test_media_processor_handler",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_resolve_media_resource_uses_requested_resource_key(monkeypatch: Any) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    assets = {
        "patience-free-guide": _FakeAsset(
            asset_id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Patience Guide",
        ),
        "sleep-routines": _FakeAsset(
            asset_id=UUID("22222222-2222-2222-2222-222222222222"),
            title="Sleep Routines Guide",
        ),
    }
    _patch_asset_repository(handler, monkeypatch, assets)

    resource_key, asset_id, tag_name, media_name = handler._resolve_media_resource(
        session=object(),
        message={"resource_key": "Sleep Routines"},
    )

    assert resource_key == "sleep-routines"
    assert asset_id == UUID("22222222-2222-2222-2222-222222222222")
    assert tag_name == "public-www-media-sleep-routines-requested"
    assert media_name == "Sleep Routines Guide"


def test_resolve_media_resource_uses_default_when_resource_key_missing(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    assets = {
        "patience-free-guide": _FakeAsset(
            asset_id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Patience Guide",
        )
    }
    _patch_asset_repository(handler, monkeypatch, assets)

    resource_key, asset_id, tag_name, media_name = handler._resolve_media_resource(
        session=object(),
        message={},
    )

    assert resource_key == "patience-free-guide"
    assert asset_id == UUID("11111111-1111-1111-1111-111111111111")
    assert tag_name == "public-www-media-patience-free-guide-requested"
    assert media_name == "Patience Guide"


def test_resolve_media_resource_falls_back_to_default_for_unknown_key(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    assets = {
        "patience-free-guide": _FakeAsset(
            asset_id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Patience Guide",
        )
    }
    _patch_asset_repository(handler, monkeypatch, assets)

    resource_key, asset_id, tag_name, media_name = handler._resolve_media_resource(
        session=object(),
        message={"resource_key": "not-in-map"},
    )

    assert resource_key == "patience-free-guide"
    assert asset_id == UUID("11111111-1111-1111-1111-111111111111")
    assert tag_name == "public-www-media-patience-free-guide-requested"
    assert media_name == "Patience Guide"


def test_resolve_media_resource_raises_when_default_asset_missing(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    _patch_asset_repository(handler, monkeypatch, assets={})

    with pytest.raises(RuntimeError, match="No media asset found for resource key"):
        handler._resolve_media_resource(session=object(), message={})


class _FakeAsset:
    def __init__(self, *, asset_id: UUID, title: str):
        self.id = asset_id
        self.title = title


def _patch_asset_repository(
    handler: Any,
    monkeypatch: Any,
    assets: dict[str, _FakeAsset],
) -> None:
    class _FakeAssetRepository:
        def __init__(self, _session: Any):
            self._assets = assets

        def find_by_resource_key(self, resource_key: str) -> _FakeAsset | None:
            return self._assets.get(resource_key)

    monkeypatch.setattr(handler, "AssetRepository", _FakeAssetRepository)


def test_should_retry_mailchimp_sync_true_when_not_synced() -> None:
    handler = _load_handler_module()
    contact = _FakeContactForMailchimp(
        mailchimp_status=MailchimpSyncStatus.FAILED,
        mailchimp_subscriber_id=None,
    )

    assert handler._should_retry_mailchimp_sync(contact) is True


def test_should_retry_mailchimp_sync_false_when_synced_with_subscriber_id() -> None:
    handler = _load_handler_module()
    contact = _FakeContactForMailchimp(
        mailchimp_status=MailchimpSyncStatus.SYNCED,
        mailchimp_subscriber_id="abc123",
    )

    assert handler._should_retry_mailchimp_sync(contact) is False


class _FakeContactForMailchimp:
    def __init__(
        self,
        *,
        mailchimp_status: MailchimpSyncStatus,
        mailchimp_subscriber_id: str | None,
    ) -> None:
        self.mailchimp_status = mailchimp_status
        self.mailchimp_subscriber_id = mailchimp_subscriber_id


def test_process_message_uses_keyword_session_for_contact_tag(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    contact = SimpleNamespace(
        id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="parent@example.com",
        mailchimp_status=MailchimpSyncStatus.SYNCED,
        mailchimp_subscriber_id="subscriber-123",
    )
    existing_lead = SimpleNamespace(id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"))
    ensure_tag_calls: list[tuple[Any, UUID, str]] = []

    class _FakeSession:
        def __init__(self, _engine: Any):
            self.committed = False

        def __enter__(self) -> _FakeSession:
            return self

        def __exit__(self, _exc_type: Any, _exc: Any, _tb: Any) -> None:
            return None

        def commit(self) -> None:
            self.committed = True

    class _FakeContactRepository:
        def __init__(self, _session: Any):
            pass

        def upsert_by_email(
            self,
            _email: str,
            *,
            first_name: str,
            source: Any,
            source_detail: str,
            contact_type: Any,
        ) -> tuple[Any, bool]:
            _ = (first_name, source, source_detail, contact_type)
            return contact, False

    class _FakeSalesLeadRepository:
        def __init__(self, _session: Any):
            pass

        def find_by_contact_and_asset(
            self,
            _contact_id: UUID,
            _lead_type: Any,
            _asset_id: UUID,
        ) -> Any:
            return existing_lead

    def _fake_ensure_contact_tag(*, session: Any, contact_id: UUID, tag_name: str) -> None:
        ensure_tag_calls.append((session, contact_id, tag_name))

    monkeypatch.setattr(handler, "get_engine", lambda: object())
    monkeypatch.setattr(handler, "Session", _FakeSession)
    monkeypatch.setattr(handler, "ContactRepository", _FakeContactRepository)
    monkeypatch.setattr(handler, "SalesLeadRepository", _FakeSalesLeadRepository)
    monkeypatch.setattr(
        handler,
        "_resolve_media_resource",
        lambda *, session, message: (
            "sleep-routines",
            UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "public-www-media-sleep-routines-requested",
            "Sleep Routines Guide",
        ),
    )
    monkeypatch.setattr(handler, "_ensure_contact_tag", _fake_ensure_contact_tag)
    monkeypatch.setattr(
        handler,
        "_ensure_share_link_url_for_asset",
        lambda **_: "https://media.example.com/v1/assets/share/TOKEN",
    )
    monkeypatch.setattr(handler, "_sync_contact_to_mailchimp", lambda **_: True)
    monkeypatch.setattr(handler, "_trigger_mailchimp_journey", lambda **_: True)

    was_processed = handler._process_message(
        {
            "first_name": "Parent",
            "email": "parent@example.com",
            "submitted_at": "2026-03-03T03:14:00+00:00",
        }
    )

    assert was_processed is False
    assert len(ensure_tag_calls) == 1
    session_arg, contact_id_arg, tag_name_arg = ensure_tag_calls[0]
    assert isinstance(session_arg, _FakeSession)
    assert contact_id_arg == contact.id
    assert tag_name_arg == "public-www-media-sleep-routines-requested"
