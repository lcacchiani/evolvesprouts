"""Unit tests for public calendar event serialization."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

from app.api import public_events
from app.db.models.enums import InstanceStatus, ServiceType


def _tag_link(name: str) -> Any:
    return SimpleNamespace(tag=SimpleNamespace(name=name))


def _partner_link(slug: str, sort_order: int, org_id: UUID | None = None) -> Any:
    oid = org_id or uuid4()
    return SimpleNamespace(
        sort_order=sort_order,
        organization_id=oid,
        organization=SimpleNamespace(slug=slug),
    )


def _repo() -> Any:
    class _R:
        def get_enrollment_count(self, _instance_id: UUID) -> int:
            return 2

    return _R()


def test_event_ticket_tier_price_and_booking_system_default() -> None:
    service = SimpleNamespace(
        title="Svc",
        description="Desc",
        service_type=ServiceType.EVENT,
        slug=None,
        booking_system=None,
        event_details=SimpleNamespace(
            event_category=SimpleNamespace(value="workshop"),
            default_price=Decimal("99"),
            default_currency="HKD",
        ),
        delivery_mode=SimpleNamespace(value="in_person"),
    )
    starts = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    ends = datetime(2026, 5, 1, 12, 0, tzinfo=UTC)
    loc = SimpleNamespace(name="Venue", address="1 Rd", lat=None, lng=None)
    inst = SimpleNamespace(
        id=uuid4(),
        slug="my-event",
        landing_page=None,
        title=None,
        description=None,
        status=InstanceStatus.OPEN,
        max_capacity=None,
        external_url=None,
        eventbrite_event_url=None,
        age_group=None,
        cohort=None,
        delivery_mode=None,
        service=service,
        session_slots=[
            SimpleNamespace(
                id=uuid4(),
                sort_order=0,
                starts_at=starts,
                ends_at=ends,
                location=loc,
            )
        ],
        location=loc,
        ticket_tiers=[
            SimpleNamespace(
                id=uuid4(),
                sort_order=0,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
                price=Decimal("250.00"),
                currency="HKD",
            )
        ],
        instance_tags=[],
        partner_organization_links=[],
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["id"] == "my-event"
    assert out["service_instance_id"] == str(inst.id)
    assert out["service_type"] == "event"
    assert out["booking_system"] == "event-booking"
    assert out["categories"] == ["workshop"]
    assert out["price"] == 250.0
    assert out["currency"] == "HKD"
    assert out["tags"] == []
    assert out["partners"] == []
    assert out["is_fully_booked"] is False


def test_event_default_price_when_no_tiers() -> None:
    service = SimpleNamespace(
        title="Svc",
        description="Desc",
        service_type=ServiceType.EVENT,
        slug="x",
        booking_system=None,
        event_details=SimpleNamespace(
            event_category=SimpleNamespace(value="seminar"),
            default_price=Decimal("10.50"),
            default_currency="USD",
        ),
        delivery_mode=SimpleNamespace(value="in_person"),
    )
    inst = _minimal_instance(service, ticket_tiers=[])
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["price"] == 10.5
    assert out["currency"] == "USD"
    assert "booking_system" in out


def test_event_no_price_when_no_tiers_and_no_default() -> None:
    service = SimpleNamespace(
        title="Svc",
        description="Desc",
        service_type=ServiceType.EVENT,
        slug="x",
        booking_system=None,
        event_details=SimpleNamespace(
            event_category=SimpleNamespace(value="seminar"),
            default_price=None,
            default_currency="HKD",
        ),
        delivery_mode=SimpleNamespace(value="in_person"),
    )
    inst = _minimal_instance(service, ticket_tiers=[])
    out = public_events._serialize_public_event(_repo(), inst)
    assert "price" not in out
    assert "currency" not in out


def test_external_url_precedence() -> None:
    service = _event_service()
    inst = _minimal_instance(
        service,
        external_url="https://example.com/new",
        eventbrite_event_url="https://eventbrite.com/old",
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["external_url"] == "https://example.com/new"


def test_external_url_eventbrite_only() -> None:
    service = _event_service()
    inst = _minimal_instance(
        service,
        external_url=None,
        eventbrite_event_url="https://eventbrite.com/e/1",
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["external_url"] == "https://eventbrite.com/e/1"


def test_instance_tags_sorted_case_insensitive() -> None:
    service = _event_service()
    inst = _minimal_instance(
        service,
        instance_tags=[
            _tag_link("zebra"),
            _tag_link("Alpha"),
            _tag_link("beta"),
        ],
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["tags"] == ["Alpha", "beta", "zebra"]


def test_partners_follow_link_order() -> None:
    service = _event_service()
    inst = _minimal_instance(
        service,
        partner_organization_links=[
            _partner_link("second", 1, uuid4()),
            _partner_link("first", 0, uuid4()),
        ],
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["partners"] == ["first", "second"]


def test_training_mba_booking_and_category() -> None:
    service = SimpleNamespace(
        title="MBA",
        description="Course",
        service_type=ServiceType.TRAINING_COURSE,
        slug="my-best-auntie",
        booking_system=None,
        event_details=None,
        delivery_mode=SimpleNamespace(value="in_person"),
    )
    inst = _minimal_instance(
        service,
        age_group="0-1",
        cohort="May 2026",
        training_details=SimpleNamespace(price=Decimal("350"), currency="HKD"),
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["service_type"] == "training_course"
    assert out["booking_system"] == "my-best-auntie-booking"
    assert out["categories"] == ["Training Course"]
    assert out["price"] == 350.0
    assert out["currency"] == "HKD"
    assert out["age_group"] == "0-1"
    assert out["cohort"] == "May 2026"


def test_training_non_mba_omits_booking_system() -> None:
    service = SimpleNamespace(
        title="Other",
        description="Course",
        service_type=ServiceType.TRAINING_COURSE,
        slug="other-course",
        booking_system=None,
        event_details=None,
        delivery_mode=SimpleNamespace(value="in_person"),
    )
    inst = _minimal_instance(
        service,
        training_details=SimpleNamespace(price=Decimal("1"), currency="HKD"),
    )
    out = public_events._serialize_public_event(_repo(), inst)
    assert "booking_system" not in out


def test_virtual_clears_location_and_url_even_with_coords() -> None:
    service = SimpleNamespace(
        title="Svc",
        description="D",
        service_type=ServiceType.EVENT,
        slug="e",
        booking_system=None,
        event_details=SimpleNamespace(
            event_category=SimpleNamespace(value="workshop"),
            default_price=None,
            default_currency="HKD",
        ),
        delivery_mode=SimpleNamespace(value="online"),
    )
    loc = SimpleNamespace(name="X", address="Y", lat=Decimal("1"), lng=Decimal("2"))
    inst = _minimal_instance(service, delivery_mode=SimpleNamespace(value="online"))
    inst.session_slots[0].location = loc
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["location"] == "virtual"
    assert out["location_name"] is None
    assert out["location_address"] is None
    assert out["location_url"] == ""


def test_physical_coord_location_url() -> None:
    service = _event_service()
    loc = SimpleNamespace(name="V", address="A", lat=Decimal("22.3"), lng=Decimal("114.1"))
    inst = _minimal_instance(service)
    inst.session_slots[0].location = loc
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["location"] == "physical"
    assert out["location_url"].startswith("https://www.google.com/maps/dir/")
    assert "%2C" in out["location_url"]


def test_physical_address_only_location_url() -> None:
    from urllib.parse import quote_plus

    from app.utils.maps import _BASE

    service = _event_service()
    addr = "Queen's Rd Central"
    loc = SimpleNamespace(name="V", address=addr, lat=None, lng=None)
    inst = _minimal_instance(service)
    inst.session_slots[0].location = loc
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["location_url"] == f"{_BASE}{quote_plus(addr)}"


def test_no_location_empty_url() -> None:
    service = _event_service()
    inst = _minimal_instance(service)
    inst.session_slots[0].location = None
    inst.location = None
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["location_url"] == ""


def test_max_capacity_none_omits_spaces() -> None:
    service = _event_service()
    inst = _minimal_instance(service, max_capacity=None)
    out = public_events._serialize_public_event(_repo(), inst)
    assert "spaces_total" not in out
    assert "spaces_left" not in out


def test_max_capacity_with_enrollments() -> None:
    service = _event_service()
    inst = _minimal_instance(service, max_capacity=8)

    class _R:
        def get_enrollment_count(self, _instance_id: UUID) -> int:
            return 10

    out = public_events._serialize_public_event(_R(), inst)
    assert out["spaces_total"] == 8
    assert out["spaces_left"] == 0


def test_id_uuid_when_no_slug() -> None:
    service = _event_service()
    iid = uuid4()
    inst = _minimal_instance(service, slug=None)
    inst.id = iid
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["id"] == str(iid)
    assert out["service_instance_id"] == str(iid)


def test_fully_booked_flag() -> None:
    service = _event_service()
    inst = _minimal_instance(service, status=InstanceStatus.FULL)
    out = public_events._serialize_public_event(_repo(), inst)
    assert out["booking_status"] == "fully_booked"
    assert out["is_fully_booked"] is True


def _event_service() -> Any:
    return SimpleNamespace(
        title="Svc",
        description="Desc",
        service_type=ServiceType.EVENT,
        slug="slug",
        booking_system=None,
        event_details=SimpleNamespace(
            event_category=SimpleNamespace(value="workshop"),
            default_price=None,
            default_currency="HKD",
        ),
        delivery_mode=SimpleNamespace(value="in_person"),
    )


def _minimal_instance(
    service: Any,
    *,
    status: InstanceStatus = InstanceStatus.OPEN,
    slug: str | None = "slug",
    ticket_tiers: list[Any] | None = None,
    instance_tags: list[Any] | None = None,
    partner_organization_links: list[Any] | None = None,
    external_url: str | None = None,
    eventbrite_event_url: str | None = None,
    max_capacity: int | None = 10,
    age_group: str | None = None,
    cohort: str | None = None,
    training_details: Any = None,
    delivery_mode: Any = None,
) -> Any:
    starts = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    ends = datetime(2026, 5, 1, 12, 0, tzinfo=UTC)
    loc = SimpleNamespace(name="V", address="1 St", lat=None, lng=None)
    return SimpleNamespace(
        id=uuid4(),
        slug=slug,
        landing_page=None,
        title=None,
        description=None,
        status=status,
        max_capacity=max_capacity,
        external_url=external_url,
        eventbrite_event_url=eventbrite_event_url,
        age_group=age_group,
        cohort=cohort,
        delivery_mode=delivery_mode,
        service=service,
        session_slots=[
            SimpleNamespace(
                id=uuid4(),
                sort_order=0,
                starts_at=starts,
                ends_at=ends,
                location=loc,
            )
        ],
        location=loc,
        ticket_tiers=ticket_tiers
        if ticket_tiers is not None
        else [
            SimpleNamespace(
                id=uuid4(),
                sort_order=0,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
                price=Decimal("1"),
                currency="HKD",
            )
        ],
        training_details=training_details,
        instance_tags=instance_tags or [],
        partner_organization_links=partner_organization_links or [],
    )
