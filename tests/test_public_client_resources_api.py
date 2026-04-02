from __future__ import annotations

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api import public_client_resources
from app.db.models import AssetType, AssetVisibility
from app.exceptions import ValidationError


def _asset_row(*, content_language: str | None = "en") -> Any:
    return SimpleNamespace(
        id=uuid4(),
        title="Welcome pack",
        description="PDF for new clients",
        asset_type=AssetType.PDF,
        file_name="welcome.pdf",
        resource_key="welcome-pack",
        content_language=content_language,
        content_type="application/pdf",
        updated_at=datetime(2026, 4, 1, 12, 0, tzinfo=UTC),
    )


def test_handle_public_client_resources_rejects_non_get(
    api_gateway_event: Any,
) -> None:
    response = public_client_resources.handle_public_client_resources_request(
        api_gateway_event(method="POST", path="/v1/assets/free"),
        "POST",
        "/v1/assets/free",
    )
    assert response["statusCode"] == 405


def test_handle_public_client_resources_accepts_www_prefixed_path(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_client_public_resources(
            self,
            *,
            limit: int,
            cursor: Any,
            language: str | None,
        ) -> list[Any]:
            return []

    monkeypatch.setattr(public_client_resources, "Session", _SessionCtx)
    monkeypatch.setattr(public_client_resources, "get_engine", lambda: object())
    monkeypatch.setattr(public_client_resources, "AssetRepository", _FakeRepository)

    response = public_client_resources.handle_public_client_resources_request(
        api_gateway_event(method="GET", path="/www/v1/assets/free"),
        "GET",
        "/www/v1/assets/free",
    )
    assert response["statusCode"] == 200


def test_handle_public_client_resources_invalid_language(
    api_gateway_event: Any,
) -> None:
    with pytest.raises(ValidationError):
        public_client_resources.handle_public_client_resources_request(
            api_gateway_event(
                method="GET",
                path="/v1/assets/free",
                query_params={"language": "not valid!"},
            ),
            "GET",
            "/v1/assets/free",
        )


def test_handle_public_client_resources_lists_items(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_client_public_resources(
            self,
            *,
            limit: int,
            cursor: Any,
            language: str | None,
        ) -> list[Any]:
            assert limit == 26
            assert cursor is None
            assert language == "zh-HK"
            return [_asset_row(content_language="zh-HK")]

    monkeypatch.setattr(public_client_resources, "Session", _SessionCtx)
    monkeypatch.setattr(public_client_resources, "get_engine", lambda: object())
    monkeypatch.setattr(public_client_resources, "AssetRepository", _FakeRepository)

    response = public_client_resources.handle_public_client_resources_request(
        api_gateway_event(
            method="GET",
            path="/v1/assets/free",
            query_params={"language": "zh-HK", "limit": "25"},
        ),
        "GET",
        "/v1/assets/free",
    )
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["title"] == "Welcome pack"
    assert item["content_language"] == "zh-HK"
    assert item["resource_key"] == "welcome-pack"
    assert "s3_key" not in item
