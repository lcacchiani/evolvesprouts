from __future__ import annotations

from typing import Any

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
