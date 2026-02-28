from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api.assets import public_assets


def test_handle_public_assets_dispatches_list_route(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(public_assets, "_list_public_assets", lambda *_: marker)

    response = public_assets.handle_public_assets_request(
        api_gateway_event(method="GET", path="/v1/assets/public"),
        "GET",
        "/v1/assets/public",
    )
    assert response is marker


def test_handle_public_assets_dispatches_download_route(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(public_assets, "_download_public_asset", lambda *_: marker)
    asset_id = str(uuid4())

    response = public_assets.handle_public_assets_request(
        api_gateway_event(method="GET", path=f"/v1/assets/public/{asset_id}/download"),
        "GET",
        f"/v1/assets/public/{asset_id}/download",
    )
    assert response is marker


def test_handle_public_assets_returns_405_for_unsupported_method(
    api_gateway_event: Any,
) -> None:
    response = public_assets.handle_public_assets_request(
        api_gateway_event(method="POST", path="/v1/assets/public"),
        "POST",
        "/v1/assets/public",
    )
    assert response["statusCode"] == 405
