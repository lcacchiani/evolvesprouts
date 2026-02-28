from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from app.api.assets import share_assets
from app.db.models import AssetVisibility


class _FakeSession:
    def __init__(self, _engine: Any) -> None:
        pass

    def __enter__(self) -> "_FakeSession":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        return False


@dataclass
class _FakeShareLink:
    asset_id: UUID
    allowed_domains: list[str]


@dataclass
class _FakeAsset:
    id: UUID
    visibility: AssetVisibility
    s3_key: str


def test_handle_share_assets_request_redirects_when_token_domain_and_asset_are_valid(
    monkeypatch: Any,
) -> None:
    asset_id = uuid4()
    share_link = _FakeShareLink(asset_id=asset_id, allowed_domains=["www.example.com"])
    asset = _FakeAsset(
        id=asset_id,
        visibility=AssetVisibility.PUBLIC,
        s3_key="assets/example.pdf",
    )

    class _Repo:
        def get_share_link_by_token(self, token: str) -> _FakeShareLink:  # noqa: ARG002
            return share_link

        def get_by_id(self, _asset_id: UUID) -> _FakeAsset:
            return asset

    monkeypatch.setattr(share_assets, "Session", _FakeSession)
    monkeypatch.setattr(share_assets, "get_engine", lambda: object())
    monkeypatch.setattr(share_assets, "AssetRepository", lambda _session: _Repo())
    monkeypatch.setattr(share_assets, "is_valid_share_token", lambda _token: True)
    monkeypatch.setattr(
        share_assets,
        "extract_request_source_domain",
        lambda _event: "www.example.com",
    )
    monkeypatch.setattr(
        share_assets,
        "generate_download_url",
        lambda **_: {"download_url": "https://cdn.example.com/file.pdf"},
    )

    response = share_assets.handle_share_assets_request(
        {"headers": {}},
        "GET",
        f"/v1/assets/share/{'A' * 24}",
    )
    assert response["statusCode"] == 302
    assert response["headers"]["Location"] == "https://cdn.example.com/file.pdf"


def test_handle_share_assets_request_forbidden_for_unapproved_source_domain(
    monkeypatch: Any,
) -> None:
    share_link = _FakeShareLink(asset_id=uuid4(), allowed_domains=["www.example.com"])

    class _Repo:
        def get_share_link_by_token(self, token: str) -> _FakeShareLink:  # noqa: ARG002
            return share_link

        def get_by_id(self, _asset_id: UUID) -> None:
            return None

    monkeypatch.setattr(share_assets, "Session", _FakeSession)
    monkeypatch.setattr(share_assets, "get_engine", lambda: object())
    monkeypatch.setattr(share_assets, "AssetRepository", lambda _session: _Repo())
    monkeypatch.setattr(share_assets, "is_valid_share_token", lambda _token: True)
    monkeypatch.setattr(
        share_assets,
        "extract_request_source_domain",
        lambda _event: "blocked.example.com",
    )

    response = share_assets.handle_share_assets_request(
        {"headers": {}},
        "GET",
        f"/v1/assets/share/{'B' * 24}",
    )
    assert response["statusCode"] == 403
