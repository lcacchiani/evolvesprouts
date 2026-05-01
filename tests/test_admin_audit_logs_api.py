from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.api import admin_audit_logs
from app.api.admin_request import encode_created_cursor, parse_created_cursor
from app.exceptions import NotFoundError, ValidationError
from app.db.models import AuditLog


def _row(
    *,
    rid: UUID | None = None,
    ts: datetime | None = None,
    user: str | None = "sub-1",
) -> AuditLog:
    return AuditLog(
        id=rid or uuid4(),
        timestamp=ts or datetime.now(timezone.utc),
        table_name="assets",
        record_id="rec-1",
        action="INSERT",
        user_id=user,
        request_id="req-1",
        old_values=None,
        new_values={"a": 1},
        changed_fields=None,
        source="trigger",
        ip_address=None,
        user_agent=None,
    )


def test_audit_logs_list_requires_identity(api_gateway_event: Any) -> None:
    with pytest.raises(ValidationError):
        admin_audit_logs.handle_admin_audit_logs_request(
            api_gateway_event(method="GET", path="/v1/admin/audit-logs"),
            "GET",
            "/v1/admin/audit-logs",
        )


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

        def execute(self, *_args: object, **_kwargs: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, _audit_id: Any) -> None:
            return None

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

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


def test_recent_list_cursor_second_page(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    t1 = datetime(2024, 1, 2, tzinfo=timezone.utc)
    t2 = datetime(2024, 1, 1, tzinfo=timezone.utc)
    id1 = uuid4()
    id2 = uuid4()
    row1 = _row(rid=id1, ts=t1)
    row2 = _row(rid=id2, ts=t2)
    calls: list[dict[str, Any]] = []

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_recent_activity(self, **kwargs: Any) -> list[AuditLog]:
            calls.append(kwargs)
            if kwargs.get("cursor") is None:
                return [row1, row2]
            return [row2]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    r1 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1"},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    assert r1["statusCode"] == 200
    body1 = json.loads(r1["body"])
    assert body1["next_cursor"]
    assert len(body1["items"]) == 1
    assert body1["items"][0]["id"] == str(id1)

    r2 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1", "cursor": body1["next_cursor"]},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body2 = json.loads(r2["body"])
    assert body2["next_cursor"] is None
    assert len(body2["items"]) == 1
    assert body2["items"][0]["id"] == str(id2)

    assert len(calls) == 2
    assert calls[0]["cursor"] is None
    c_ts, c_id = calls[1]["cursor"]
    assert c_ts == t1
    assert c_id == id1


def test_user_id_filter_cursor_second_page(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    t1 = datetime(2024, 2, 2, tzinfo=timezone.utc)
    t2 = datetime(2024, 2, 1, tzinfo=timezone.utc)
    id1 = uuid4()
    id2 = uuid4()
    row1 = _row(rid=id1, ts=t1)
    row2 = _row(rid=id2, ts=t2)
    calls: list[dict[str, Any]] = []

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_user_activity(self, **kwargs: Any) -> list[AuditLog]:
            calls.append(kwargs)
            if kwargs.get("cursor") is None:
                return [row1, row2]
            return [row2]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    uid = "user-sub-abc"
    r1 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1", "user_id": uid},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body1 = json.loads(r1["body"])
    assert body1["next_cursor"]
    assert body1["items"][0]["id"] == str(id1)

    r2 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1", "user_id": uid, "cursor": body1["next_cursor"]},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body2 = json.loads(r2["body"])
    assert body2["next_cursor"] is None
    assert body2["items"][0]["id"] == str(id2)
    assert calls[0]["user_id"] == uid
    assert calls[1]["cursor"] is not None


def test_table_filter_cursor_second_page(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    t1 = datetime(2024, 3, 2, tzinfo=timezone.utc)
    t2 = datetime(2024, 3, 1, tzinfo=timezone.utc)
    id1 = uuid4()
    id2 = uuid4()
    row1 = _row(rid=id1, ts=t1)
    row2 = _row(rid=id2, ts=t2)
    calls: list[dict[str, Any]] = []

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_table_activity(self, **kwargs: Any) -> list[AuditLog]:
            calls.append(kwargs)
            if kwargs.get("cursor") is None:
                return [row1, row2]
            return [row2]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    r1 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1", "table": "assets"},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body1 = json.loads(r1["body"])
    assert body1["next_cursor"]
    assert body1["items"][0]["id"] == str(id1)

    r2 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1", "table": "assets", "cursor": body1["next_cursor"]},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body2 = json.loads(r2["body"])
    assert body2["next_cursor"] is None
    assert body2["items"][0]["id"] == str(id2)
    assert calls[0]["table_name"] == "assets"
    assert calls[1]["cursor"] is not None


def test_record_id_table_cursor_second_page(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    t1 = datetime(2024, 4, 2, tzinfo=timezone.utc)
    t2 = datetime(2024, 4, 1, tzinfo=timezone.utc)
    id1 = uuid4()
    id2 = uuid4()
    row1 = _row(rid=id1, ts=t1)
    row2 = _row(rid=id2, ts=t2)
    calls: list[dict[str, Any]] = []

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_record_history(self, **kwargs: Any) -> list[AuditLog]:
            calls.append(kwargs)
            if kwargs.get("cursor") is None:
                return [row1, row2]
            return [row2]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    rid = "rec-xyz"
    r1 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "1", "table": "assets", "record_id": rid},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body1 = json.loads(r1["body"])
    assert body1["next_cursor"]
    assert body1["items"][0]["id"] == str(id1)

    r2 = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={
                "limit": "1",
                "table": "assets",
                "record_id": rid,
                "cursor": body1["next_cursor"],
            },
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body2 = json.loads(r2["body"])
    assert body2["next_cursor"] is None
    assert body2["items"][0]["id"] == str(id2)
    assert calls[0]["record_id"] == rid
    assert calls[1]["cursor"] is not None


def test_table_filter_cursor_passed(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    row = _row()
    calls: list[dict[str, Any]] = []

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_table_activity(self, **kwargs: Any) -> list[AuditLog]:
            calls.append(kwargs)
            return [row]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    cur = encode_created_cursor(row.timestamp, row.id)
    assert cur
    admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"table": "assets", "cursor": cur},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    assert calls[0]["cursor"] is not None
    assert calls[0]["cursor"][1] == row.id


def test_next_cursor_null_when_not_full_page(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    row = _row()

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_recent_activity(self, **_kwargs: Any) -> list[AuditLog]:
            return [row]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    r = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"limit": "10"},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body = json.loads(r["body"])
    assert body["next_cursor"] is None


def test_recent_list_empty_returns_200(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regression: empty result must not IndexError when building next_cursor."""

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_recent_activity(self, **_kwargs: Any) -> list[AuditLog]:
            return []

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    r = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["items"] == []
    assert body["next_cursor"] is None


def test_email_filter_resolves_sub(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    resolved_sub = "cognito-sub-xyz"
    row = _row(user=resolved_sub)
    cognito_calls: list[dict[str, Any]] = []
    repo_calls: list[dict[str, Any]] = []

    def fake_invoke(_svc: str, _action: str, params: dict[str, Any]) -> dict[str, Any]:
        cognito_calls.append(params)
        return {
            "Users": [
                {
                    "Attributes": [
                        {"Name": "sub", "Value": resolved_sub},
                        {"Name": "email", "Value": "a@b.com"},
                    ],
                }
            ],
        }

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_user_activity(self, **kwargs: Any) -> list[AuditLog]:
            repo_calls.append(kwargs)
            return [row]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs.aws_proxy, "invoke", fake_invoke)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {"cognito-sub-xyz": "a@b.com"})
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "pool-1")

    r = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"email": "a@b.com"},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert len(body["items"]) == 1
    assert body["items"][0]["user_email"] == "a@b.com"
    assert repo_calls[0]["user_id"] == resolved_sub
    assert 'email = "a@b.com"' in cognito_calls[0]["Filter"]


def test_email_filter_no_users_returns_empty(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_invoke(_svc: str, _action: str, _params: dict[str, Any]) -> dict[str, Any]:
        return {"Users": []}

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_user_activity(self, **_kwargs: Any) -> list[AuditLog]:
            raise AssertionError("repo should not run when email has no match")

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs.aws_proxy, "invoke", fake_invoke)
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "pool-1")

    r = admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"email": "nobody@example.com"},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    body = json.loads(r["body"])
    assert body == {"items": [], "next_cursor": None}


def test_email_and_user_id_rejected(
    api_gateway_event: Any, admin_identity: dict[str, str]
) -> None:
    with pytest.raises(ValidationError):
        admin_audit_logs.handle_admin_audit_logs_request(
            api_gateway_event(
                method="GET",
                path="/v1/admin/audit-logs",
                query_params={"email": "a@b.com", "user_id": "x"},
                authorizer_context=admin_identity,
            ),
            "GET",
            "/v1/admin/audit-logs",
        )


def test_invalid_email_rejected(
    api_gateway_event: Any, admin_identity: dict[str, str]
) -> None:
    with pytest.raises(ValidationError) as exc:
        admin_audit_logs.handle_admin_audit_logs_request(
            api_gateway_event(
                method="GET",
                path="/v1/admin/audit-logs",
                query_params={"email": "not-an-email"},
                authorizer_context=admin_identity,
            ),
            "GET",
            "/v1/admin/audit-logs",
        )
    assert exc.value.field == "email"


def test_record_history_cursor(
    api_gateway_event: Any, admin_identity: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    row = _row()
    calls: list[dict[str, Any]] = []

    class _Session:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> "_Session":
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def execute(self, *_a: object, **_k: object) -> None:
            return None

    class _Repo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_record_history(self, **kwargs: Any) -> list[AuditLog]:
            calls.append(kwargs)
            return [row]

    monkeypatch.setattr(admin_audit_logs, "Session", _Session)
    monkeypatch.setattr(admin_audit_logs, "get_engine", lambda: object())
    monkeypatch.setattr(admin_audit_logs, "AuditLogRepository", _Repo)
    monkeypatch.setattr(admin_audit_logs, "_cognito_emails_for_subs", lambda _s: {})

    cur = encode_created_cursor(row.timestamp, row.id)
    admin_audit_logs.handle_admin_audit_logs_request(
        api_gateway_event(
            method="GET",
            path="/v1/admin/audit-logs",
            query_params={"table": "assets", "record_id": "rid", "cursor": cur},
            authorizer_context=admin_identity,
        ),
        "GET",
        "/v1/admin/audit-logs",
    )
    assert calls[0]["cursor"] is not None
    ts, rid = parse_created_cursor(cur)
    assert ts == row.timestamp
    assert rid == row.id
