from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_services
from app.exceptions import ValidationError


def test_delete_service_raises_when_instances_exist(monkeypatch: Any) -> None:
    service_id = uuid4()
    deleted: dict[str, bool] = {"called": False}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeServiceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, sid: Any) -> object:
            assert sid == service_id
            return object()

        def delete(self, _service: Any) -> None:
            deleted["called"] = True

    class _FakeInstanceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def count_for_service_id(self, sid: Any) -> int:
            assert sid == service_id
            return 2

    monkeypatch.setattr(admin_services, "Session", _SessionCtx)
    monkeypatch.setattr(admin_services, "get_engine", lambda: object())
    monkeypatch.setattr(admin_services, "set_audit_context", lambda *_a, **_k: None)
    monkeypatch.setattr(admin_services, "ServiceRepository", _FakeServiceRepository)
    monkeypatch.setattr(admin_services, "ServiceInstanceRepository", _FakeInstanceRepository)

    with pytest.raises(ValidationError) as exc_info:
        admin_services._delete_service(
            {"requestContext": {"requestId": "rid"}},
            service_id=service_id,
            actor_sub="actor",
        )
    assert exc_info.value.status_code == 409
    assert "instances" in exc_info.value.message.lower()
    assert deleted["called"] is False


def test_list_services_includes_instance_counts(monkeypatch: Any, api_gateway_event: Any) -> None:
    sid_a, sid_b = uuid4(), uuid4()
    row_a = SimpleNamespace(id=sid_a)
    row_b = SimpleNamespace(id=sid_b)

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeServiceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_services(self, **_kwargs: Any) -> list[Any]:
            return [row_a, row_b]

        def count_services(self, **_kwargs: Any) -> int:
            return 2

        def count_instances_by_service_ids(self, ids: list[Any]) -> dict[Any, int]:
            assert set(ids) == {sid_a, sid_b}
            return {sid_a: 1, sid_b: 0}

    captured: list[dict[str, Any]] = []

    def _capture_summary(service: Any, *, instances_count: int) -> dict[str, Any]:
        captured.append({"id": service.id, "instances_count": instances_count})
        return {"id": str(service.id), "instances_count": instances_count}

    monkeypatch.setattr(admin_services, "Session", _SessionCtx)
    monkeypatch.setattr(admin_services, "get_engine", lambda: object())
    monkeypatch.setattr(admin_services, "ServiceRepository", _FakeServiceRepository)
    monkeypatch.setattr(admin_services, "encode_service_cursor", lambda _row: None)
    monkeypatch.setattr(admin_services, "serialize_service_summary", _capture_summary)
    monkeypatch.setattr(
        admin_services,
        "parse_service_filters",
        lambda _event: {
            "limit": 10,
            "service_type": None,
            "status": None,
            "search": None,
            "cursor_created_at": None,
            "cursor_id": None,
        },
    )

    response = admin_services._list_services(
        api_gateway_event(method="GET", path="/v1/admin/services", query_params={"limit": "10"})
    )
    assert response["statusCode"] == 200
    body = response["body"]
    payload = json.loads(body) if isinstance(body, str) else body
    assert captured == [
        {"id": sid_a, "instances_count": 1},
        {"id": sid_b, "instances_count": 0},
    ]
    assert payload["items"][0]["instances_count"] == 1
    assert payload["items"][1]["instances_count"] == 0
