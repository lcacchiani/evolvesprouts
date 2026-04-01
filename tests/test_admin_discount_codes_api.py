from __future__ import annotations

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_discount_codes
from app.api.admin_services_payloads import ensure_discount_validity_window
from app.exceptions import ValidationError


def test_list_discount_codes_returns_repository_total_count(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(id=uuid4())
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeDiscountCodeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_codes(self, **kwargs: Any) -> list[Any]:
            captured["list_kwargs"] = kwargs
            return [row, row]

        def count_codes(self, **kwargs: Any) -> int:
            captured["count_kwargs"] = kwargs
            return 17

    monkeypatch.setattr(
        admin_discount_codes,
        "parse_discount_code_filters",
        lambda _event: {
            "limit": 1,
            "active": None,
            "service_id": None,
            "instance_id": None,
            "search": None,
            "cursor_created_at": None,
            "cursor_id": None,
        },
    )
    monkeypatch.setattr(admin_discount_codes, "Session", _SessionCtx)
    monkeypatch.setattr(admin_discount_codes, "get_engine", lambda: object())
    monkeypatch.setattr(
        admin_discount_codes,
        "DiscountCodeRepository",
        _FakeDiscountCodeRepository,
    )
    monkeypatch.setattr(
        admin_discount_codes,
        "serialize_discount_code",
        lambda _item: {"id": "code-1"},
    )
    monkeypatch.setattr(
        admin_discount_codes,
        "encode_discount_code_cursor",
        lambda _item: "next-cursor",
    )

    response = admin_discount_codes._list_discount_codes(
        api_gateway_event(method="GET", path="/v1/admin/discount-codes")
    )

    body = json.loads(response["body"])
    assert body["total_count"] == 17
    assert captured["list_kwargs"]["limit"] == 2
    assert captured["count_kwargs"]["search"] is None


def test_ensure_discount_validity_window_rejects_inverted_range() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_discount_validity_window(
            datetime(2026, 2, 1, tzinfo=UTC),
            datetime(2026, 1, 1, tzinfo=UTC),
        )
    assert exc_info.value.field == "valid_until"
