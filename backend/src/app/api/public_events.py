"""Public calendar events feed handlers."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import Service, ServiceInstance
from app.db.models.enums import InstanceStatus, ServiceType
from app.db.models.service_instance import InstanceSessionSlot

if TYPE_CHECKING:
    from app.db.models.location import Location
from app.db.repositories.service_instance import ServiceInstanceRepository
from app.utils import json_response
from app.utils.logging import get_logger
from app.utils.maps import build_google_maps_directions_url

logger = get_logger(__name__)

_LANDING_PAGE_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def handle_public_events(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle GET /v1/calendar/public and /www/v1/calendar/public."""
    logger.info("Handling public events feed request", extra={"method": method})
    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    query = event.get("queryStringParameters") or {}
    landing_page = _parse_landing_page(query.get("landing_page"))
    service_types = _parse_service_type_filter(query.get("service_type"))

    with Session(get_engine()) as session:
        repository = ServiceInstanceRepository(session)
        items = _fetch_public_offerings(
            repository,
            now=datetime.now(UTC),
            service_types=service_types,
            landing_page=landing_page,
        )
    # Keep a temporary alias for older consumers while "events" is canonical.
    return json_response(200, {"events": items, "items": items}, event=event)


def handle_public_calendar_events_request(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Backward-compatible entrypoint for public calendar events."""
    return handle_public_events(event, method)


def _parse_landing_page(raw: str | None) -> str | None:
    if raw is None:
        return None
    if len(raw) > 255:
        return None
    if not _LANDING_PAGE_PATTERN.fullmatch(raw):
        return None
    return raw


def _parse_service_type_filter(raw: str | None) -> set[ServiceType] | None:
    if raw is None:
        return None
    if raw == "event":
        return {ServiceType.EVENT}
    if raw == "training_course":
        return {ServiceType.TRAINING_COURSE}
    return None


def _fetch_public_offerings(
    repository: ServiceInstanceRepository,
    *,
    now: datetime,
    service_types: set[ServiceType] | None,
    landing_page: str | None,
) -> list[dict[str, Any]]:
    types = (
        service_types
        if service_types is not None
        else {ServiceType.EVENT, ServiceType.TRAINING_COURSE}
    )
    rows = repository.list_public_offerings(
        limit=100,
        now=now,
        service_types=types,
        landing_page=landing_page,
    )
    return [_serialize_public_event(repository, instance) for instance in rows]


def _resolve_primary_location(
    instance: ServiceInstance,
    slots: list[InstanceSessionSlot],
) -> Location | None:
    if slots and slots[0].location is not None:
        return slots[0].location
    return instance.location


def _resolve_primary_price(
    instance: ServiceInstance,
) -> tuple[float | None, str | None]:
    service = instance.service
    if service.service_type == ServiceType.EVENT:
        if instance.ticket_tiers:
            sorted_tiers = sorted(
                instance.ticket_tiers,
                key=lambda tier: (tier.sort_order, tier.created_at, tier.id),
            )
            selected = sorted_tiers[0]
            return _decimal_to_float(selected.price), selected.currency
        details = service.event_details
        if details is not None and details.default_price is not None:
            return _decimal_to_float(details.default_price), details.default_currency
        return None, None
    if service.service_type == ServiceType.TRAINING_COURSE:
        td = instance.training_details
        if td is not None:
            return _decimal_to_float(td.price), td.currency
        return None, None
    return None, None


def _resolve_booking_system(service: Service) -> str | None:
    if service.booking_system:
        return service.booking_system
    if service.service_type == ServiceType.EVENT:
        return "event-booking"
    if service.service_type == ServiceType.TRAINING_COURSE:
        if service.slug == "my-best-auntie":
            return "my-best-auntie-booking"
        return None
    return None


def _resolve_categories(service: Service) -> list[str]:
    if service.service_type == ServiceType.EVENT:
        details = service.event_details
        if details is not None:
            return [details.event_category.value]
        return []
    if service.service_type == ServiceType.TRAINING_COURSE:
        return ["Training Course"]
    return []


def _resolve_tags(instance: ServiceInstance) -> list[str]:
    links = instance.instance_tags
    names = {link.tag.name for link in links if link.tag and link.tag.name}
    return sorted(names, key=str.casefold)


def _resolve_partners(instance: ServiceInstance) -> list[str]:
    ordered = sorted(
        instance.partner_organization_links,
        key=lambda link: (link.sort_order, str(link.organization_id)),
    )
    return [
        link.organization.slug
        for link in ordered
        if link.organization is not None and link.organization.slug
    ]


def _resolve_external_url(instance: ServiceInstance) -> str | None:
    return instance.external_url or instance.eventbrite_event_url or None


def _serialize_public_event(
    repository: ServiceInstanceRepository,
    instance: ServiceInstance,
) -> dict[str, Any]:
    service = instance.service
    title = instance.title or service.title
    summary = instance.description or service.description

    slots = sorted(instance.session_slots, key=lambda s: (s.sort_order, s.starts_at))
    dates = [
        {
            "id": str(s.id),
            "start_datetime": _iso(s.starts_at),
            "end_datetime": _iso(s.ends_at),
        }
        for s in slots
    ]

    primary_location = _resolve_primary_location(instance, slots)
    is_virtual = _is_virtual_delivery_mode(instance, service)

    location_name = (
        None
        if is_virtual
        else _clean_text(primary_location.name if primary_location else None)
    )
    location_address = (
        None
        if is_virtual
        else _clean_text(primary_location.address if primary_location else None)
    )
    location_url = ""
    if not is_virtual and primary_location is not None:
        derived = build_google_maps_directions_url(
            address=primary_location.address,
            lat=primary_location.lat,
            lng=primary_location.lng,
        )
        if derived is not None:
            location_url = derived

    price, currency = _resolve_primary_price(instance)
    booking_status = (
        "fully_booked" if instance.status == InstanceStatus.FULL else "open"
    )

    payload: dict[str, Any] = {
        "id": instance.slug or str(instance.id),
        "service_instance_id": str(instance.id),
        "service_type": service.service_type.value,
        "title": title,
        "summary": summary,
        "description": summary,
        "status": _map_instance_status(instance.status),
        "booking_status": booking_status,
        "is_fully_booked": booking_status == "fully_booked",
        "location": "virtual" if is_virtual else "physical",
        "location_name": location_name,
        "location_address": location_address,
        "location_url": location_url,
        "dates": dates,
        "tags": _resolve_tags(instance),
        "categories": _resolve_categories(service),
        "partners": _resolve_partners(instance),
    }

    booking_system = _resolve_booking_system(service)
    if booking_system is not None:
        payload["booking_system"] = booking_system

    if price is not None:
        payload["price"] = price
    if currency is not None:
        payload["currency"] = currency

    external_url = _resolve_external_url(instance)
    if external_url:
        payload["external_url"] = external_url

    if instance.slug is not None:
        payload["slug"] = instance.slug
    if instance.landing_page is not None:
        payload["landing_page"] = instance.landing_page
    if instance.age_group is not None:
        payload["age_group"] = instance.age_group
    if instance.cohort is not None:
        payload["cohort"] = instance.cohort

    if instance.max_capacity is not None:
        filled = repository.get_enrollment_count(instance.id)
        payload["spaces_total"] = instance.max_capacity
        payload["spaces_left"] = max(0, instance.max_capacity - filled)

    return payload


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _map_instance_status(status: InstanceStatus) -> str:
    if status == InstanceStatus.CANCELLED:
        return "cancelled"
    if status == InstanceStatus.COMPLETED:
        return "completed"
    return "open"


def _is_virtual_delivery_mode(instance: ServiceInstance, service: Service) -> bool:
    resolved = (
        instance.delivery_mode if instance.delivery_mode else service.delivery_mode
    )
    return resolved.value == "online"


def _iso(value: datetime | None) -> str:
    return value.isoformat() if value is not None else ""
