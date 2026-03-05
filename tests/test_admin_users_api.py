from __future__ import annotations

from typing import Any

from app.api import admin_users


def test_handle_admin_users_dispatches_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_users, "_list_admin_users", lambda _event: marker)

    response = admin_users.handle_admin_users_request(
        api_gateway_event(method="GET", path="/v1/admin/users"),
        "GET",
        "/v1/admin/users",
    )

    assert response is marker


def test_handle_admin_users_rejects_non_get(api_gateway_event: Any) -> None:
    response = admin_users.handle_admin_users_request(
        api_gateway_event(method="POST", path="/v1/admin/users"),
        "POST",
        "/v1/admin/users",
    )
    assert response["statusCode"] == 405
