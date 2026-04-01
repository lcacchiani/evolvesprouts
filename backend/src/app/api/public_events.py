"""Public calendar events feed handlers."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import Service, ServiceInstance
from app.db.models.enums import InstanceStatus
from app.db.repositories.service_instance import ServiceInstanceRepository
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def handle_public_events(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle GET /v1/calendar/events and /www/v1/calendar/events."""
    logger.info("Handling public events feed request", extra={"method": method})
    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    with Session(get_engine()) as session:
        repository = ServiceInstanceRepository(session)
        items = _fetch_event_instances(
            repository,
            now=datetime.now(UTC),
        )
    # Keep a temporary alias for older consumers while "events" is canonical.
    return json_response(200, {"events": items, "items": items}, event=event)


def handle_public_calendar_events_request(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Backward-compatible entrypoint for public calendar events."""
    return handle_public_events(event, method)


def _fetch_event_instances(
    repository: ServiceInstanceRepository,
    *,
    now: datetime,
) -> list[dict[str, Any]]:
    rows = repository.list_event_instances_for_public_feed(
        limit=100,
        now=now,
    )
    return [_serialize_public_event(repository, instance) for instance in rows]


def _serialize_public_event(
    repository: ServiceInstanceRepository,
    instance: ServiceInstance,
) -> dict[str, Any]:
    service = instance.service
    title = instance.title if instance.title else service.title
    summary = instance.description if instance.description else service.description

    slots = sorted(
        instance.session_slots, key=lambda slot: (slot.sort_order, slot.starts_at)
    )
    dates = [
        {
            "id": str(slot.id),
            "start_datetime": _iso(slot.starts_at),
            "end_datetime": _iso(slot.ends_at),
        }
        for slot in slots
    ]

    primary_location = (
        slots[0].location if slots and slots[0].location else instance.location
    )
    location_name = _clean_text(primary_location.name if primary_location else None)
    location_address = _clean_text(
        primary_location.address if primary_location else None
    )

    price, currency = _resolve_primary_ticket_price(instance)
    booking_status = (
        "fully_booked" if instance.status == InstanceStatus.FULL else "open"
    )
    event_status = _map_instance_status(instance.status)

    payload: dict[str, Any] = {
        "id": str(instance.id),
        "title": title,
        "summary": summary,
        "description": summary,
        "status": event_status,
        "booking_status": booking_status,
        "booking_system": "event-booking",
        "location": "virtual"
        if _is_virtual_delivery_mode(instance, service)
        else "physical",
        "location_name": location_name,
        "location_address": location_address,
        "location_url": "",
        "dates": dates,
        "tags": [],
        "categories": [service.event_details.event_category.value]
        if service.event_details is not None
        else [],
    }
    if price is not None:
        payload["price"] = price
    if currency is not None:
        payload["currency"] = currency
    if instance.eventbrite_event_url:
        payload["external_url"] = instance.eventbrite_event_url
    if instance.slug is not None:
        payload["slug"] = instance.slug
    if instance.landing_page is not None:
        payload["landing_page"] = instance.landing_page
    if instance.max_capacity is not None:
        filled = repository.get_enrollment_count(instance.id)
        payload["spaces_total"] = instance.max_capacity
        payload["spaces_left"] = max(0, instance.max_capacity - filled)
    return payload


def _resolve_primary_ticket_price(
    instance: ServiceInstance,
) -> tuple[float | None, str | None]:
    if not instance.ticket_tiers:
        return None, None
    sorted_tiers = sorted(
        instance.ticket_tiers,
        key=lambda tier: (tier.sort_order, tier.created_at, tier.id),
    )
    selected = sorted_tiers[0]
    return _decimal_to_float(selected.price), selected.currency


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
