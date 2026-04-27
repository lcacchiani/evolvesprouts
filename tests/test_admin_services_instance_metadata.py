"""Tests for instance cohort and tag_ids parsing."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.api.admin_services_payloads import (
    parse_create_instance_payload,
    parse_update_instance_payload,
)
from app.db.models import (
    ConsultationDetails,
    EventDetails,
    Service,
    ServiceInstance,
    ServiceInstanceTag,
    Tag,
    TrainingCourseDetails,
    TrainingInstanceDetails,
)
from app.db.models.enums import (
    ConsultationFormat,
    ConsultationPricingModel,
    EventCategory,
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


def test_parse_create_instance_payload_persists_cohort() -> None:
    service = _minimal_training_service()
    body = {
        "slug": "spring-2026-run",
        "cohort": "Spring-2026",
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    parsed = parse_create_instance_payload(body, service)
    assert parsed["cohort"] == "spring-2026"


def test_parse_create_instance_payload_rejects_invalid_cohort_field() -> None:
    service = _minimal_training_service()
    body = {
        "slug": "valid-slug",
        "cohort": "Bad_Slug",
        "training_details": {
            "training_format": "group",
            "price": "10.00",
            "currency": "HKD",
            "pricing_unit": "per_person",
        },
    }
    with pytest.raises(ValidationError) as exc:
        parse_create_instance_payload(body, service)
    assert exc.value.field == "cohort"


def test_parse_create_instance_payload_rejects_deprecated_age_group() -> None:
    service = _minimal_training_service()
    body = {
        "slug": "x",
        "age_group": "0-1",
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


def test_parse_update_instance_payload_rejects_deprecated_age_group() -> None:
    service = _minimal_training_service()
    body = {"status": "scheduled", "age_group": "0-1"}
    with pytest.raises(ValidationError) as exc:
        parse_update_instance_payload(body, service)
    assert exc.value.field == "age_group"


def test_parse_create_instance_payload_accepts_tag_ids() -> None:
    service = _minimal_training_service()
    t1, t2 = uuid4(), uuid4()
    body = {
        "slug": "tagged-run",
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


def test_training_instance_round_trip_cohort_tags_in_memory() -> None:
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
        description=None,
        cover_image_s3_key=None,
        status=InstanceStatus.SCHEDULED,
        delivery_mode=None,
        location_id=None,
        max_capacity=None,
        waitlist_enabled=False,
        instructor_id=None,
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
    assert "age_group" not in payload
    assert payload["cohort"] == "spring-2026"
    assert [t["name"] for t in payload["tags"]] == ["alpha", "Beta"]
    assert payload["tag_ids"] == [str(tag_aa.id), str(tag_ba.id)]


def test_serialize_instance_resolves_from_parent_service_when_missing() -> None:
    """Effective fields fall back to the parent service template."""
    from app.api.admin_services_serializers import serialize_instance

    sid = uuid4()
    loc_id = uuid4()
    service = Service(
        id=sid,
        service_type=ServiceType.TRAINING_COURSE,
        title="Parent title",
        slug="parent-slug",
        booking_system=None,
        description="Parent body",
        cover_image_s3_key=None,
        delivery_mode=ServiceDeliveryMode.IN_PERSON,
        status=ServiceStatus.PUBLISHED,
        created_by="tester",
        location_id=loc_id,
    )
    service.training_course_details = TrainingCourseDetails(
        service_id=sid,
        pricing_unit=TrainingPricingUnit.PER_FAMILY,
        default_price=Decimal("88.50"),
        default_currency="USD",
    )

    inst_id = uuid4()
    instance = ServiceInstance(
        id=inst_id,
        service_id=sid,
        title=None,
        slug=None,
        description=None,
        cover_image_s3_key=None,
        status=InstanceStatus.SCHEDULED,
        delivery_mode=None,
        location_id=None,
        max_capacity=None,
        waitlist_enabled=False,
        instructor_id=None,
        cohort=None,
        notes=None,
        created_by="tester",
        external_url=None,
    )
    instance.service = service
    instance.instance_tags = []
    instance.session_slots = []
    instance.ticket_tiers = []
    instance.partner_organization_links = []

    payload = serialize_instance(instance)
    assert payload["resolved_title"] == "Parent title"
    assert payload["resolved_slug"] == "parent-slug"
    assert payload["resolved_description"] == "Parent body"
    assert payload["resolved_delivery_mode"] == "in_person"
    assert payload["resolved_location_id"] == str(loc_id)
    assert payload["training_details"] is None
    assert payload["resolved_training_details"] == {
        "training_format": "group",
        "price": "88.50",
        "currency": "USD",
        "pricing_unit": "per_family",
    }


def test_serialize_instance_resolves_event_and_consultation_from_service() -> None:
    from app.api.admin_services_serializers import serialize_instance

    sid = uuid4()
    inst_id = uuid4()

    event_service = Service(
        id=sid,
        service_type=ServiceType.EVENT,
        title="Evt",
        slug=None,
        booking_system=None,
        description=None,
        cover_image_s3_key=None,
        delivery_mode=ServiceDeliveryMode.ONLINE,
        status=ServiceStatus.PUBLISHED,
        created_by="t",
    )
    event_service.event_details = EventDetails(
        service_id=sid,
        event_category=EventCategory.OPEN_HOUSE,
        default_price=Decimal("25.00"),
        default_currency="HKD",
    )
    ev_instance = ServiceInstance(
        id=inst_id,
        service_id=sid,
        title="Inst",
        slug=None,
        description=None,
        cover_image_s3_key=None,
        status=InstanceStatus.SCHEDULED,
        delivery_mode=None,
        location_id=None,
        max_capacity=None,
        waitlist_enabled=False,
        instructor_id=None,
        cohort=None,
        notes=None,
        created_by="t",
        external_url=None,
    )
    ev_instance.service = event_service
    ev_instance.instance_tags = []
    ev_instance.session_slots = []
    ev_instance.ticket_tiers = []
    ev_instance.partner_organization_links = []

    ev_payload = serialize_instance(ev_instance)
    assert ev_payload["event_ticket_tiers"] == []
    assert len(ev_payload["resolved_event_ticket_tiers"]) == 1
    tier0 = ev_payload["resolved_event_ticket_tiers"][0]
    assert tier0["name"] == "open_house"
    assert tier0["price"] == "25.00"
    assert tier0["currency"] == "HKD"

    csid = uuid4()
    cinst = uuid4()
    cons_service = Service(
        id=csid,
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
    cons_service.consultation_details = ConsultationDetails(
        service_id=csid,
        consultation_format=ConsultationFormat.ONE_ON_ONE,
        max_group_size=None,
        duration_minutes=60,
        pricing_model=ConsultationPricingModel.HOURLY,
        default_hourly_rate=Decimal("120.00"),
        default_package_price=None,
        default_package_sessions=None,
        default_currency="HKD",
    )
    cons_instance = ServiceInstance(
        id=cinst,
        service_id=csid,
        title="C",
        slug=None,
        description=None,
        cover_image_s3_key=None,
        status=InstanceStatus.SCHEDULED,
        delivery_mode=None,
        location_id=None,
        max_capacity=None,
        waitlist_enabled=False,
        instructor_id=None,
        cohort=None,
        notes=None,
        created_by="t",
        external_url=None,
    )
    cons_instance.service = cons_service
    cons_instance.instance_tags = []
    cons_instance.session_slots = []
    cons_instance.ticket_tiers = []
    cons_instance.partner_organization_links = []

    c_payload = serialize_instance(cons_instance)
    assert c_payload["consultation_details"] is None
    assert c_payload["resolved_consultation_details"] == {
        "pricing_model": "hourly",
        "price": "120.00",
        "currency": "HKD",
        "package_sessions": None,
    }
