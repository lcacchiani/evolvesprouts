"""Tests for admin asset content replace (init/complete) handlers."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID, uuid4

import pytest
from botocore.exceptions import ClientError

from app.api.assets import admin_assets
from app.api.assets.assets_common import RequestIdentity
from app.db.models import Asset, AssetType, AssetVisibility
from app.exceptions import ValidationError


def _identity() -> RequestIdentity:
    return RequestIdentity(
        user_sub="admin-sub",
        groups={"admin"},
        organization_ids=set(),
    )


def _make_asset(
    *,
    asset_id: UUID,
    s3_key: str = "assets/old/key.pdf",
) -> Asset:
    return Asset(
        id=asset_id,
        title="T",
        description=None,
        asset_type=AssetType.DOCUMENT,
        s3_key=s3_key,
        file_name="old.pdf",
        resource_key=None,
        content_type="application/pdf",
        content_language=None,
        visibility=AssetVisibility.RESTRICTED,
        created_by="u",
    )


def test_complete_rejects_file_name_mismatch_with_key_derived_name(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
) -> None:
    asset_id = uuid4()
    pending = f"assets/{asset_id}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-guide.pdf"

    monkeypatch.setattr(admin_assets, "extract_identity", lambda _e: _identity())
    monkeypatch.setattr(
        admin_assets,
        "parse_complete_asset_content_replace_payload",
        lambda _e: {
            "pending_s3_key": pending,
            "file_name": "wrong.pdf",
            "content_type": "application/pdf",
        },
    )

    def _head_ok(**_kwargs: Any) -> dict[str, Any]:
        return {"ContentType": "application/pdf"}

    monkeypatch.setattr(admin_assets, "head_s3_object", _head_ok)

    with pytest.raises(ValidationError, match="file_name"):
        admin_assets._complete_asset_content_replace(  # noqa: SLF001
            api_gateway_event(
                method="POST",
                path=f"/v1/admin/assets/{asset_id}/content/complete",
                body=json.dumps(
                    {
                        "pending_s3_key": pending,
                        "file_name": "wrong.pdf",
                        "content_type": "application/pdf",
                    }
                ),
            ),
            asset_id,
        )


def test_complete_raises_when_head_no_such_key(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
) -> None:
    asset_id = uuid4()
    pending = f"assets/{asset_id}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-missing.pdf"

    monkeypatch.setattr(admin_assets, "extract_identity", lambda _e: _identity())
    monkeypatch.setattr(
        admin_assets,
        "parse_complete_asset_content_replace_payload",
        lambda _e: {
            "pending_s3_key": pending,
            "file_name": "missing.pdf",
            "content_type": None,
        },
    )

    def _head_fail(**_kwargs: Any) -> dict[str, Any]:
        raise ClientError(
            {"Error": {"Code": "NoSuchKey"}, "ResponseMetadata": {"HTTPStatusCode": 404}},
            "HeadObject",
        )

    monkeypatch.setattr(admin_assets, "head_s3_object", _head_fail)

    with pytest.raises(ValidationError, match="not found"):
        admin_assets._complete_asset_content_replace(  # noqa: SLF001
            api_gateway_event(method="POST", path="/x", body="{}"),
            asset_id,
        )


def test_complete_blocks_expense_tagged_asset(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
) -> None:
    asset_id = uuid4()
    pending = f"assets/{asset_id}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-x.pdf"

    monkeypatch.setattr(admin_assets, "extract_identity", lambda _e: _identity())
    monkeypatch.setattr(
        admin_assets,
        "parse_complete_asset_content_replace_payload",
        lambda _e: {
            "pending_s3_key": pending,
            "file_name": "x.pdf",
            "content_type": None,
        },
    )
    monkeypatch.setattr(admin_assets, "head_s3_object", lambda **_k: {"ContentType": "application/pdf"})
    monkeypatch.setattr(admin_assets, "asset_links_expense_attachment", lambda _a: True)

    class _Repo:
        def get_with_asset_tags(self, _id: UUID) -> Asset:
            return _make_asset(asset_id=asset_id)

    class _Sess:
        def __enter__(self) -> _Sess:
            return self

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(admin_assets, "Session", lambda _e: _Sess())
    monkeypatch.setattr(admin_assets, "get_engine", lambda: object())
    monkeypatch.setattr(admin_assets, "set_audit_context", lambda *a, **k: None)
    monkeypatch.setattr(admin_assets, "AssetRepository", lambda _s: _Repo())

    with pytest.raises(ValidationError, match="expense"):
        admin_assets._complete_asset_content_replace(  # noqa: SLF001
            api_gateway_event(method="POST", path="/x", body="{}"),
            asset_id,
        )


def test_validate_pending_key_rejects_traversal_and_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.assets.assets_common import validate_pending_asset_content_s3_key

    aid = uuid4()
    with pytest.raises(ValidationError):
        validate_pending_asset_content_s3_key(
            asset_id=aid, pending_key=f"assets/{aid}/../other/x.pdf"
        )
    with pytest.raises(ValidationError):
        validate_pending_asset_content_s3_key(
            asset_id=aid, pending_key=f"  assets/{aid}/x.pdf"
        )
    with pytest.raises(ValidationError):
        validate_pending_asset_content_s3_key(asset_id=aid, pending_key="assets/other/x.pdf")


def test_complete_success_updates_and_deletes_previous(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
) -> None:
    asset_id = uuid4()
    old_key = f"assets/{asset_id}/old-segment.pdf"
    pending = f"assets/{asset_id}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-newdoc.pdf"
    asset = _make_asset(asset_id=asset_id, s3_key=old_key)

    monkeypatch.setattr(admin_assets, "extract_identity", lambda _e: _identity())
    monkeypatch.setattr(
        admin_assets,
        "parse_complete_asset_content_replace_payload",
        lambda _e: {
            "pending_s3_key": pending,
            "file_name": "newdoc.pdf",
            "content_type": None,
        },
    )
    monkeypatch.setattr(
        admin_assets,
        "head_s3_object",
        lambda **_k: {"ContentType": "application/pdf"},
    )

    deleted: list[str] = []

    def _delete_s3(*, s3_key: str) -> None:
        deleted.append(s3_key)

    monkeypatch.setattr(admin_assets, "delete_s3_object", _delete_s3)

    class _Repo:
        def __init__(self) -> None:
            self.updated = False

        def get_with_asset_tags(self, _id: UUID) -> Asset:
            return asset

        def update_asset(self, a: Asset, **kwargs: Any) -> Asset:
            self.updated = True
            a.s3_key = kwargs["s3_key"]
            a.file_name = kwargs["file_name"]
            a.content_type = kwargs["content_type"]
            return a

    repo = _Repo()

    class _Sess:
        committed = False

        def __enter__(self) -> _Sess:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def commit(self) -> None:
            self.committed = True

        def flush(self) -> None:
            return None

    sess = _Sess()
    monkeypatch.setattr(admin_assets, "Session", lambda _e: sess)
    monkeypatch.setattr(admin_assets, "get_engine", lambda: object())
    monkeypatch.setattr(admin_assets, "set_audit_context", lambda *a, **k: None)
    monkeypatch.setattr(admin_assets, "AssetRepository", lambda _s: repo)

    resp = admin_assets._complete_asset_content_replace(  # noqa: SLF001
        api_gateway_event(method="POST", path="/x", body="{}"),
        asset_id,
    )
    assert resp["statusCode"] == 200
    assert repo.updated is True
    assert sess.committed is True
    assert deleted == [old_key]
    body = json.loads(resp["body"])
    assert body["asset"]["s3_key"] == pending
    assert body["asset"]["file_name"] == "newdoc.pdf"
    assert body["asset"]["content_type"] == "application/pdf"


def test_second_complete_same_pending_after_success_raises(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
) -> None:
    """After DB points at pending key, second complete with same key hits 'nothing to replace'."""
    asset_id = uuid4()
    pending = f"assets/{asset_id}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-doc.pdf"

    monkeypatch.setattr(admin_assets, "extract_identity", lambda _e: _identity())
    monkeypatch.setattr(
        admin_assets,
        "parse_complete_asset_content_replace_payload",
        lambda _e: {
            "pending_s3_key": pending,
            "file_name": "doc.pdf",
            "content_type": "application/pdf",
        },
    )
    monkeypatch.setattr(
        admin_assets,
        "head_s3_object",
        lambda **_k: {"ContentType": "application/pdf"},
    )
    monkeypatch.setattr(admin_assets, "delete_s3_object", lambda **_k: None)

    asset = _make_asset(asset_id=asset_id, s3_key=pending)

    class _Repo:
        def get_with_asset_tags(self, _id: UUID) -> Asset:
            return asset

        def update_asset(self, a: Asset, **kwargs: Any) -> Asset:
            return a

    class _Sess:
        def __enter__(self) -> _Sess:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def commit(self) -> None:
            return None

        def flush(self) -> None:
            return None

    monkeypatch.setattr(admin_assets, "Session", lambda _e: _Sess())
    monkeypatch.setattr(admin_assets, "get_engine", lambda: object())
    monkeypatch.setattr(admin_assets, "set_audit_context", lambda *a, **k: None)
    monkeypatch.setattr(admin_assets, "AssetRepository", lambda _s: _Repo())

    with pytest.raises(ValidationError, match="nothing to replace"):
        admin_assets._complete_asset_content_replace(  # noqa: SLF001
            api_gateway_event(method="POST", path="/x", body="{}"),
            asset_id,
        )


def test_delete_previous_logs_warning_on_failure(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    api_gateway_event: Any,
) -> None:
    import logging

    asset_id = uuid4()
    old_key = f"assets/{asset_id}/old.pdf"
    pending = f"assets/{asset_id}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-new.pdf"
    asset = _make_asset(asset_id=asset_id, s3_key=old_key)

    monkeypatch.setattr(admin_assets, "extract_identity", lambda _e: _identity())
    monkeypatch.setattr(
        admin_assets,
        "parse_complete_asset_content_replace_payload",
        lambda _e: {
            "pending_s3_key": pending,
            "file_name": "new.pdf",
            "content_type": "application/pdf",
        },
    )
    monkeypatch.setattr(
        admin_assets,
        "head_s3_object",
        lambda **_k: {"ContentType": "application/pdf"},
    )

    def _delete_fail(**_kwargs: Any) -> None:
        raise ClientError(
            {"Error": {"Code": "AccessDenied"}, "ResponseMetadata": {"HTTPStatusCode": 403}},
            "DeleteObject",
        )

    monkeypatch.setattr(admin_assets, "delete_s3_object", _delete_fail)

    class _Repo:
        def get_with_asset_tags(self, _id: UUID) -> Asset:
            return asset

        def update_asset(self, a: Asset, **kwargs: Any) -> Asset:
            return a

    class _Sess:
        def __enter__(self) -> _Sess:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def commit(self) -> None:
            return None

        def flush(self) -> None:
            return None

    monkeypatch.setattr(admin_assets, "Session", lambda _e: _Sess())
    monkeypatch.setattr(admin_assets, "get_engine", lambda: object())
    monkeypatch.setattr(admin_assets, "set_audit_context", lambda *a, **k: None)
    monkeypatch.setattr(admin_assets, "AssetRepository", lambda _s: _Repo())

    with caplog.at_level(logging.WARNING):
        resp = admin_assets._complete_asset_content_replace(  # noqa: SLF001
            api_gateway_event(method="POST", path="/x", body="{}"),
            asset_id,
        )
    assert resp["statusCode"] == 200
    assert any("replace_delete_failed" in r.message for r in caplog.records)
