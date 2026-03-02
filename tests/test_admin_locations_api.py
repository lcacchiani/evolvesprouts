from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api import admin_locations


def test_handle_admin_locations_dispatches_collection_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_locations, "_list_locations", lambda _: marker)

    response = admin_locations.handle_admin_locations_request(
        api_gateway_event(method="GET", path="/v1/admin/locations"),
        "GET",
        "/v1/admin/locations",
    )

    assert response is marker


def test_handle_admin_locations_dispatches_resource_patch(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    captured: dict[str, Any] = {}

    def _fake_update(_event: Any, _location_id: Any, *, partial: bool) -> dict[str, Any]:
        captured["partial"] = partial
        return marker

    monkeypatch.setattr(admin_locations, "_update_location", _fake_update)
    location_id = str(uuid4())

    response = admin_locations.handle_admin_locations_request(
        api_gateway_event(method="PATCH", path=f"/v1/admin/locations/{location_id}"),
        "PATCH",
        f"/v1/admin/locations/{location_id}",
    )

    assert response is marker
    assert captured["partial"] is True


def test_handle_admin_locations_rejects_collection_patch(api_gateway_event: Any) -> None:
    response = admin_locations.handle_admin_locations_request(
        api_gateway_event(method="PATCH", path="/v1/admin/locations"),
        "PATCH",
        "/v1/admin/locations",
    )
    assert response["statusCode"] == 405
