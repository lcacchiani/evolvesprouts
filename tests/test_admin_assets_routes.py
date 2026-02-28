from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api.assets import admin_assets
from app.api.assets.assets_common import RequestIdentity


def _admin_identity() -> RequestIdentity:
    return RequestIdentity(
        user_sub="admin-sub",
        groups={"admin"},
        organization_ids={"org-1"},
    )


def test_handle_admin_assets_dispatches_list_route(monkeypatch: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_assets, "extract_identity", lambda _: _admin_identity())
    monkeypatch.setattr(admin_assets, "_list_assets", lambda _: marker)

    response = admin_assets.handle_admin_assets_request(
        {"headers": {}},
        "GET",
        "/v1/admin/assets",
    )
    assert response is marker


def test_handle_admin_assets_returns_405_for_unsupported_collection_method(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(admin_assets, "extract_identity", lambda _: _admin_identity())

    response = admin_assets.handle_admin_assets_request(
        {"headers": {}},
        "PATCH",
        "/v1/admin/assets",
    )
    assert response["statusCode"] == 405


def test_handle_admin_assets_returns_404_for_non_admin_path() -> None:
    response = admin_assets.handle_admin_assets_request(
        {"headers": {}},
        "GET",
        "/v1/unknown/assets",
    )
    assert response["statusCode"] == 404


def test_handle_admin_assets_dispatches_patch_update_route(monkeypatch: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    captured: dict[str, Any] = {}
    monkeypatch.setattr(admin_assets, "extract_identity", lambda _: _admin_identity())

    def _fake_update(_event: Any, _asset_id: Any, *, partial: bool) -> dict[str, Any]:
        captured["partial"] = partial
        return marker

    monkeypatch.setattr(admin_assets, "_update_asset", _fake_update)
    asset_id = str(uuid4())

    response = admin_assets.handle_admin_assets_request(
        {"headers": {}},
        "PATCH",
        f"/v1/admin/assets/{asset_id}",
    )
    assert response is marker
    assert captured["partial"] is True
