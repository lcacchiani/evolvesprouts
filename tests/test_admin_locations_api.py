from __future__ import annotations

import json
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_locations


def test_handle_admin_locations_dispatches_geocode_post(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_locations, "_geocode_location", lambda _: marker)

    response = admin_locations.handle_admin_locations_request(
        api_gateway_event(method="POST", path="/v1/admin/locations/geocode"),
        "POST",
        "/v1/admin/locations/geocode",
    )

    assert response is marker


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


def test_serialize_location_emits_float_coordinates_for_json() -> None:
    """Decimals must become JSON numbers so clients are not forced to parse strings."""
    loc_id = uuid4()
    area_id = uuid4()
    location = SimpleNamespace(
        id=loc_id,
        name="Studio",
        area_id=area_id,
        address="1 Main St",
        lat=Decimal("22.319300"),
        lng=Decimal("114.169400"),
        created_at=None,
        updated_at=None,
    )
    payload = admin_locations._serialize_location(location)  # type: ignore[arg-type]
    assert payload["lat"] == 22.3193
    assert payload["lng"] == 114.1694
    assert isinstance(payload["lat"], float)
    assert isinstance(payload["lng"], float)
    encoded = json.dumps({"lat": payload["lat"], "lng": payload["lng"]})
    roundtrip = json.loads(encoded)
    assert roundtrip["lat"] == pytest.approx(22.3193)
    assert roundtrip["lng"] == pytest.approx(114.1694)
