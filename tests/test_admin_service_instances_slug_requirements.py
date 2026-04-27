"""Slug requirements for event and training_course instance create/update."""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest

from app.api.admin_services_payloads import (
    parse_create_instance_payload,
    parse_update_instance_payload,
)
from app.db.models import EventDetails, Service
from app.db.models.enums import (
    EventCategory,
    InstanceStatus,
    ServiceDeliveryMode,
    ServiceStatus,
    ServiceType,
)
from app.exceptions import ValidationError


def _event_service() -> Service:
    sid = uuid4()
    s = Service(
        id=sid,
        service_type=ServiceType.EVENT,
        title="Workshop",
        slug="ws-svc",
        booking_system=None,
        description=None,
        cover_image_s3_key=None,
        delivery_mode=ServiceDeliveryMode.IN_PERSON,
        status=ServiceStatus.PUBLISHED,
        created_by="t",
    )
    s.event_details = EventDetails(
        service_id=sid,
        event_category=EventCategory.WORKSHOP,
        default_price=Decimal("10.00"),
        default_currency="HKD",
    )
    return s


def _training_service() -> Service:
    sid = uuid4()
    return Service(
        id=sid,
        service_type=ServiceType.TRAINING_COURSE,
        title="Course",
        slug="course-slug",
        booking_system=None,
        description=None,
        cover_image_s3_key=None,
        delivery_mode=ServiceDeliveryMode.ONLINE,
        status=ServiceStatus.PUBLISHED,
        created_by="t",
    )


def _consultation_service() -> Service:
    sid = uuid4()
    return Service(
        id=sid,
        service_type=ServiceType.CONSULTATION,
        title="Cons",
        slug=None,
        booking_system=None,
        description=None,
        cover_image_s3_key=None,
        delivery_mode=ServiceDeliveryMode.ONLINE,
        status=ServiceStatus.PUBLISHED,
        created_by="t",
    )


def test_parse_create_instance_requires_slug_for_event() -> None:
    service = _event_service()
    body = {
        "status": "scheduled",
        "session_slots": [],
        "event_ticket_tiers": [{"price": "10.00", "currency": "HKD"}],
    }
    with pytest.raises(ValidationError) as exc:
        parse_create_instance_payload(body, service)
    assert exc.value.field == "slug"


def test_parse_create_instance_requires_slug_for_training_course() -> None:
    service = _training_service()
    body = {
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    with pytest.raises(ValidationError) as exc:
        parse_create_instance_payload(body, service)
    assert exc.value.field == "slug"


def test_parse_create_instance_allows_missing_slug_for_consultation() -> None:
    service = _consultation_service()
    body = {
        "consultation_details": {
            "pricing_model": "free",
            "currency": "HKD",
        },
    }
    parsed = parse_create_instance_payload(body, service)
    assert parsed["slug"] is None


def test_parse_update_instance_rejects_clearing_slug_for_event() -> None:
    service = _event_service()
    body = {
        "status": "scheduled",
        "slug": None,
        "event_ticket_tiers": [{"price": "10.00", "currency": "HKD"}],
    }
    with pytest.raises(ValidationError) as exc:
        parse_update_instance_payload(body, service)
    assert exc.value.field == "slug"


def test_parse_update_instance_accepts_slug_for_event() -> None:
    service = _event_service()
    body = {
        "status": "scheduled",
        "slug": "my-event-2026-04-01",
        "event_ticket_tiers": [{"price": "10.00", "currency": "HKD"}],
    }
    parsed = parse_update_instance_payload(body, service)
    assert parsed["slug"] == "my-event-2026-04-01"


def test_parse_create_instance_accepts_slug_for_event() -> None:
    service = _event_service()
    body = {
        "slug": "spring-workshop-2026-04-20",
        "status": "scheduled",
        "session_slots": [],
        "event_ticket_tiers": [{"price": "10.00", "currency": "HKD"}],
    }
    parsed = parse_create_instance_payload(body, service)
    assert parsed["slug"] == "spring-workshop-2026-04-20"


def test_parse_create_instance_accepts_slug_for_training() -> None:
    service = _training_service()
    body = {
        "slug": "run-a",
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    parsed = parse_create_instance_payload(body, service)
    assert parsed["slug"] == "run-a"


def test_parse_update_instance_allows_clearing_slug_for_consultation() -> None:
    service = _consultation_service()
    body = {
        "status": InstanceStatus.SCHEDULED.value,
        "slug": None,
        "consultation_details": {
            "pricing_model": "free",
            "currency": "HKD",
        },
    }
    parsed = parse_update_instance_payload(body, service)
    assert parsed.get("slug") is None
