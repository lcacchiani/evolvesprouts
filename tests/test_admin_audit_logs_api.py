from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_audit_logs
from app.exceptions import NotFoundError, ValidationError


def test_audit_logs_list_requires_identity(api_gateway_event: Any) -> None:
    with pytest.raises(ValidationError):
        admin_audit_logs.handle_admin_audit_logs_request(
            api_gateway_event(method="GET", path="/v1/admin/audit-logs"),
            "GET",
            "/v1/admin/audit-logs",
        )


def test_audit_logs_no_match_user_id_short_circuits(
    api_gateway_event: Any, admin_identity: dict[str, str]
) -> None:
    response = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"user_id": "__no_match__"},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body == {"items": [], "next_cursor": None}


def test_audit_logs_rejects_unknown_table(
    api_gateway_event: Any, admin_identity: dict[str, str]
) -> None:
    with pytest.raises(ValidationError):
        admin_audit_logs.handle_admin_audit_logs_request(
            api_gateway_event(
                method="GET",
                path="/v1/admin/audit-logs",
                query_params={"table": "not_a_table"},
                authorizer_context=admin_identity,
            ),
            "GET",
            "/v1/admin/audit-logs",
        )


def test_audit_logs_get_by_id_not_found(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    class _Session:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def execute(self, *args: object, **kwargs: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, _audit_id: Any) -> None:
            return None

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)

    missing = str(uuid4())
    with pytest.raises(NotFoundError):
        admin_audit_logs.handle_admin_audit_logs_request(
            api_gateway_event(
                method="GET",
                path=f"/v1/admin/audit-logs/{missing}",
                authorizer_context=admin_identity,
            ),
            "GET",
            f"/v1/admin/audit-logs/{missing}",
        )
