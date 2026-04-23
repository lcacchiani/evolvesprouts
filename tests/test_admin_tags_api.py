from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_tags
from app.exceptions import ValidationError


def test_handle_admin_tags_list_get(monkeypatch: Any, api_gateway_event: Any) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_tags, "_list_tags", lambda _: marker)
    monkeypatch.setattr(
        admin_tags,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_tags.handle_admin_tags_request(
        api_gateway_event(method="GET", path="/v1/admin/tags"),
        "GET",
        "/v1/admin/tags",
    )
    assert response is marker


def test_handle_admin_tags_post(monkeypatch: Any, api_gateway_event: Any) -> None:
    marker = {"statusCode": 201, "body": "{}"}
    monkeypatch.setattr(admin_tags, "_create_tag", lambda _event, *, actor_sub: marker)
    monkeypatch.setattr(
        admin_tags,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_tags.handle_admin_tags_request(
        api_gateway_event(method="POST", path="/v1/admin/tags", body="{}"),
        "POST",
        "/v1/admin/tags",
    )
    assert response is marker


def test_parse_include_archived_invalid() -> None:
    event = {
        "queryStringParameters": {"include_archived": "maybe"},
        "multiValueQueryStringParameters": None,
    }
    with pytest.raises(ValidationError, match="include_archived"):
        admin_tags._parse_include_archived(event)


def test_parse_optional_hex_color_rejects_bad() -> None:
    with pytest.raises(ValidationError):
        admin_tags._parse_optional_hex_color("red", field="color")


def test_serialize_admin_tag_includes_usage(monkeypatch: Any) -> None:
    tag_id = uuid4()
    tag = SimpleNamespace(
        id=tag_id,
        name="Alpha",
        color="#aabbcc",
        description="d",
        archived_at=None,
    )
    session = object()
    monkeypatch.setattr(admin_tags, "_tag_usage_count", lambda _s, _tid: 3)

    payload = admin_tags._serialize_admin_tag(session, tag)
    assert payload["id"] == str(tag_id)
    assert payload["name"] == "Alpha"
    assert payload["color"] == "#aabbcc"
    assert payload["description"] == "d"
    assert payload["archived_at"] is None
    assert payload["usage_count"] == 3
