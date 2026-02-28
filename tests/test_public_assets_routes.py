from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api.assets import public_assets


def test_handle_public_assets_dispatches_list_route(monkeypatch: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(public_assets, "_list_public_assets", lambda *_: marker)

    response = public_assets.handle_public_assets_request(
        {"headers": {}},
        "GET",
        "/v1/assets/public",
    )
    assert response is marker


def test_handle_public_assets_dispatches_download_route(monkeypatch: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(public_assets, "_download_public_asset", lambda *_: marker)
    asset_id = str(uuid4())

    response = public_assets.handle_public_assets_request(
        {"headers": {}},
        "GET",
        f"/v1/assets/public/{asset_id}/download",
    )
    assert response is marker


def test_handle_public_assets_returns_405_for_unsupported_method() -> None:
    response = public_assets.handle_public_assets_request(
        {"headers": {}},
        "POST",
        "/v1/assets/public",
    )
    assert response["statusCode"] == 405
