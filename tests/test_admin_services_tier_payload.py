"""Tests for parse_optional_service_tier and service payload integration."""

from __future__ import annotations

import pytest

from app.api.admin_services_payloads import (
    parse_create_service_payload,
    parse_optional_service_tier,
    parse_update_service_payload,
)
from app.db.models.enums import ServiceDeliveryMode, ServiceType
from app.exceptions import ValidationError


def test_parse_optional_service_tier_none_and_blank() -> None:
    assert parse_optional_service_tier(None) is None
    assert parse_optional_service_tier("   ") is None


def test_parse_optional_service_tier_valid_and_normalized() -> None:
    assert parse_optional_service_tier("  Ages-3-5  ") == "ages-3-5"


def test_parse_optional_service_tier_rejects_bad_pattern() -> None:
    with pytest.raises(ValidationError) as exc:
        parse_optional_service_tier("Bad_Slug")
    assert exc.value.field == "service_tier"


def test_parse_optional_service_tier_rejects_too_long() -> None:
    long_val = "a" * 129
    with pytest.raises(ValidationError) as exc:
        parse_optional_service_tier(long_val)
    assert exc.value.field == "service_tier"


def test_parse_create_service_payload_includes_service_tier_and_location() -> None:
    loc = "550e8400-e29b-41d4-a716-446655440000"
    body = {
        "service_type": "training_course",
        "title": "Course",
        "delivery_mode": "online",
        "service_tier": "  tier-one  ",
        "location_id": loc,
        "training_details": {
            "pricing_unit": "per_person",
            "default_price": "10.00",
            "default_currency": "HKD",
        },
    }
    parsed = parse_create_service_payload(body)
    assert parsed["service_tier"] == "tier-one"
    assert str(parsed["location_id"]) == loc
    assert parsed["service_type"] == ServiceType.TRAINING_COURSE


def test_parse_update_service_payload_partial_service_tier() -> None:
    body = {"service_tier": ""}
    parsed = parse_update_service_payload(body, partial=True)
    assert parsed["service_tier"] is None


def test_parse_update_service_payload_partial_location_id() -> None:
    loc = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    body = {"location_id": loc}
    parsed = parse_update_service_payload(body, partial=True)
    assert str(parsed["location_id"]) == loc


def test_parse_update_service_payload_put_requires_title_and_delivery() -> None:
    body = {
        "title": "T",
        "delivery_mode": ServiceDeliveryMode.IN_PERSON.value,
        "service_tier": "abc",
    }
    parsed = parse_update_service_payload(body, partial=False)
    assert parsed["service_tier"] == "abc"
