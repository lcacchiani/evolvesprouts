from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api import admin_vendors


def test_handle_admin_vendors_dispatches_collection_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_vendors, "_list_vendors", lambda _: marker)
    monkeypatch.setattr(
        admin_vendors,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_vendors.handle_admin_vendors_request(
        api_gateway_event(method="GET", path="/v1/admin/vendors"),
        "GET",
        "/v1/admin/vendors",
    )

    assert response is marker


def test_handle_admin_vendors_dispatches_resource_patch(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(
        admin_vendors,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )
    vendor_id = str(uuid4())

    def _fake_update(
        _event: Any,
        *,
        vendor_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(vendor_id)
        return marker

    monkeypatch.setattr(admin_vendors, "_update_vendor", _fake_update)

    response = admin_vendors.handle_admin_vendors_request(
        api_gateway_event(method="PATCH", path=f"/v1/admin/vendors/{vendor_id}"),
        "PATCH",
        f"/v1/admin/vendors/{vendor_id}",
    )

    assert response is marker


def test_handle_admin_vendors_rejects_collection_patch(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    monkeypatch.setattr(
        admin_vendors,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )
    response = admin_vendors.handle_admin_vendors_request(
        api_gateway_event(method="PATCH", path="/v1/admin/vendors"),
        "PATCH",
        "/v1/admin/vendors",
    )
    assert response["statusCode"] == 405
