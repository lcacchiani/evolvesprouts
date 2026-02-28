from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api.assets import user_assets
from app.api.assets.assets_common import RequestIdentity


def _user_identity() -> RequestIdentity:
    return RequestIdentity(
        user_sub="user-sub",
        groups={"parent"},
        organization_ids={"org-1"},
    )


def test_handle_user_assets_dispatches_list_route(monkeypatch: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(user_assets, "extract_identity", lambda _: _user_identity())
    monkeypatch.setattr(user_assets, "_list_accessible_assets", lambda *_: marker)

    response = user_assets.handle_user_assets_request(
        {"headers": {}},
        "GET",
        "/v1/user/assets",
    )
    assert response is marker


def test_handle_user_assets_dispatches_download_route(monkeypatch: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(user_assets, "extract_identity", lambda _: _user_identity())
    monkeypatch.setattr(user_assets, "_download_asset", lambda *_: marker)
    asset_id = str(uuid4())

    response = user_assets.handle_user_assets_request(
        {"headers": {}},
        "GET",
        f"/v1/user/assets/{asset_id}/download",
    )
    assert response is marker


def test_handle_user_assets_returns_405_for_unsupported_method(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(user_assets, "extract_identity", lambda _: _user_identity())
    response = user_assets.handle_user_assets_request(
        {"headers": {}},
        "POST",
        "/v1/user/assets",
    )
    assert response["statusCode"] == 405
