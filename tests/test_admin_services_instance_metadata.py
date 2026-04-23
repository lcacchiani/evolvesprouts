"""Tests for instance age_group, cohort, and tag_ids parsing."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.api.admin_services_payloads import parse_create_instance_payload
from app.db.models import (
    Service,
    ServiceInstance,
    ServiceInstanceTag,
    Tag,
    TrainingInstanceDetails,
)
from app.db.models.enums import (
    InstanceStatus,
    ServiceDeliveryMode,
    ServiceStatus,
    ServiceType,
    TrainingFormat,
    TrainingPricingUnit,
)
from app.exceptions import ValidationError

pytestmark = pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")


def _minimal_training_service() -> Service:
    sid = uuid4()
    return Service(
        id=sid,
        service_type=ServiceType.TRAINING_COURSE,
        title="Course",
        slug=None,
        booking_system=None,
        description=None,
        cover_image_s3_key=None,
        delivery_mode=ServiceDeliveryMode.ONLINE,
        status=ServiceStatus.PUBLISHED,
        created_by="tester",
    )


def test_parse_create_instance_payload_persists_age_group_and_cohort() -> None:
    service = _minimal_training_service()
    body = {
        "age_group": "  Ages-3-5  ",
        "cohort": "Spring-2026",
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    parsed = parse_create_instance_payload(body, service)
    assert parsed["age_group"] == "ages-3-5"
    assert parsed["cohort"] == "spring-2026"


def test_parse_create_instance_payload_rejects_invalid_age_group_field() -> None:
    service = _minimal_training_service()
    body = {
        "age_group": "Bad_Slug",
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    with pytest.raises(ValidationError) as exc:
        parse_create_instance_payload(body, service)
    assert exc.value.field == "age_group"


def test_parse_create_instance_payload_accepts_tag_ids() -> None:
    service = _minimal_training_service()
    t1, t2 = uuid4(), uuid4()
    body = {
        "tag_ids": [str(t2), str(t1)],
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    parsed = parse_create_instance_payload(body, service)
    assert parsed["tag_ids"] == [t2, t1]


def test_training_instance_round_trip_age_cohort_tags_in_memory() -> None:
    """ORM-only check: fields map and serializer ordering matches tag name (case-insensitive)."""
    from app.api.admin_services_serializers import serialize_instance

    service = _minimal_training_service()
    inst_id = uuid4()
    tag_ba = Tag(
        id=uuid4(),
        name="Beta",
        color=None,
        description=None,
        created_by="t",
    )
    tag_aa = Tag(
        id=uuid4(),
        name="alpha",
        color=None,
        description=None,
        created_by="t",
    )
    instance = ServiceInstance(
        id=inst_id,
        service_id=service.id,
        title=None,
        slug=None,
        landing_page=None,
        description=None,
        cover_image_s3_key=None,
        status=InstanceStatus.SCHEDULED,
        delivery_mode=None,
        location_id=None,
        max_capacity=None,
        waitlist_enabled=False,
        instructor_id=None,
        age_group="ages-3-5",
        cohort="spring-2026",
        notes=None,
        created_by="tester",
        external_url=None,
    )
    instance.service = service
    link_ba = ServiceInstanceTag(
        service_instance_id=inst_id,
        tag_id=tag_ba.id,
        created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    link_ba.tag = tag_ba
    link_aa = ServiceInstanceTag(
        service_instance_id=inst_id,
        tag_id=tag_aa.id,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    link_aa.tag = tag_aa
    instance.instance_tags = [link_ba, link_aa]
    instance.training_details = TrainingInstanceDetails(
        instance_id=inst_id,
        training_format=TrainingFormat.GROUP,
        price=Decimal("10.00"),
        currency="HKD",
        pricing_unit=TrainingPricingUnit.PER_PERSON,
    )
    instance.session_slots = []
    instance.ticket_tiers = []
    instance.partner_organization_links = []

    payload = serialize_instance(instance)
    assert payload["age_group"] == "ages-3-5"
    assert payload["cohort"] == "spring-2026"
    assert [t["name"] for t in payload["tags"]] == ["alpha", "Beta"]
    assert payload["tag_ids"] == [str(tag_aa.id), str(tag_ba.id)]
