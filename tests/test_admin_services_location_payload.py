"""Tests for services.location_id parsing on create/update."""

from __future__ import annotations

from uuid import UUID

import pytest

from app.api.admin_services_payloads import parse_create_service_payload, parse_update_service_payload
from app.exceptions import ValidationError


def test_parse_create_service_payload_location_round_trip() -> None:
    loc = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    body = {
        "service_type": "event",
        "title": "E",
        "delivery_mode": "online",
        "location_id": loc,
        "event_details": {
            "event_category": "workshop",
            "default_price": None,
            "default_currency": "HKD",
        },
    }
    parsed = parse_create_service_payload(body)
    assert isinstance(parsed["location_id"], UUID)
    assert str(parsed["location_id"]) == loc


def test_parse_create_service_payload_blank_location_is_none() -> None:
    body = {
        "service_type": "event",
        "title": "E",
        "delivery_mode": "online",
        "location_id": "  ",
        "event_details": {
            "event_category": "workshop",
            "default_price": None,
            "default_currency": "HKD",
        },
    }
    parsed = parse_create_service_payload(body)
    assert parsed["location_id"] is None


def test_parse_create_service_payload_invalid_location_uuid() -> None:
    body = {
        "service_type": "event",
        "title": "E",
        "delivery_mode": "online",
        "location_id": "not-a-uuid",
        "event_details": {
            "event_category": "workshop",
            "default_price": None,
            "default_currency": "HKD",
        },
    }
    with pytest.raises(ValidationError) as exc:
        parse_create_service_payload(body)
    assert exc.value.field == "location_id"


def test_parse_update_service_payload_partial_blank_location() -> None:
    body = {"location_id": ""}
    parsed = parse_update_service_payload(body, partial=True)
    assert parsed["location_id"] is None
