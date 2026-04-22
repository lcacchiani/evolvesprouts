"""Handler-level tests for admin organizations routes."""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from app.api import admin_organizations
from app.api.admin import lambda_handler


def test_list_organizations_default_excludes_vendors_from_repository_filter(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """Unfiltered list should not pass relationship_types (repository excludes vendors)."""
    captured: dict[str, Any] = {}

    class _FakeRepo:
        def __init__(self, _session: object) -> None:
            pass

        def list_organizations(self, **kwargs: Any) -> list[object]:
            captured["list"] = kwargs
            return []

        def count_organizations(self, **kwargs: Any) -> int:
            captured["count"] = kwargs
            return 0

    class _FakeSessionCtx:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(admin_organizations, "OrganizationRepository", _FakeRepo)
    monkeypatch.setattr(admin_organizations, "Session", lambda _engine: _FakeSessionCtx())
    monkeypatch.setattr(admin_organizations, "get_engine", lambda: object())
    monkeypatch.setattr(
        admin_organizations,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    admin_organizations.handle_admin_organizations_request(
        api_gateway_event(method="GET", path="/v1/admin/organizations"),
        "GET",
        "/v1/admin/organizations",
    )

    assert captured["list"].get("relationship_types") is None
    assert captured["list"].get("include_relationships") is True
    assert captured["count"].get("relationship_types") is None


def test_list_organizations_vendor_query_sets_vendor_filter_and_skips_relationship_loads(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    from app.db.models import RelationshipType

    captured: dict[str, Any] = {}

    class _FakeRepo:
        def __init__(self, _session: object) -> None:
            pass

        def list_organizations(self, **kwargs: Any) -> list[object]:
            captured["list"] = kwargs
            return []

        def count_organizations(self, **kwargs: Any) -> int:
            captured["count"] = kwargs
            return 0

    class _FakeSessionCtx:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(admin_organizations, "OrganizationRepository", _FakeRepo)
    monkeypatch.setattr(admin_organizations, "Session", lambda _engine: _FakeSessionCtx())
    monkeypatch.setattr(admin_organizations, "get_engine", lambda: object())
    monkeypatch.setattr(
        admin_organizations,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    admin_organizations.handle_admin_organizations_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/organizations",
            query_params={"relationship_type": "vendor"},
        ),
        "GET",
        "/v1/admin/organizations",
    )

    assert captured["list"]["relationship_types"] == (RelationshipType.VENDOR,)
    assert captured["list"]["include_relationships"] is False
    assert captured["count"]["relationship_types"] == (RelationshipType.VENDOR,)


def test_get_organization_returns_404_when_crm_loader_finds_nothing(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """CRM GET by id uses get_non_vendor_organization_by_id (e.g. vendor rows are invisible)."""

    class _FakeRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_non_vendor_organization_by_id(self, _organization_id: object) -> None:
            return None

    class _FakeSessionCtx:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(admin_organizations, "OrganizationRepository", _FakeRepo)
    monkeypatch.setattr(admin_organizations, "Session", lambda _engine: _FakeSessionCtx())
    monkeypatch.setattr(admin_organizations, "get_engine", lambda: object())
    monkeypatch.setattr(
        admin_organizations,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    org_id = str(uuid4())
    event = api_gateway_event(
        method="GET",
        path=f"/v1/admin/organizations/{org_id}",
        authorizer_context={"userSub": "admin-sub"},
    )
    response = lambda_handler(event, None)
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert "error" in body
