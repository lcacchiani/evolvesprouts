"""Public calendar events feed handlers."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.engine import get_engine
from app.db.models import Service, ServiceInstance, ServiceType
from app.db.models.enums import InstanceStatus
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def handle_public_calendar_events_request(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle GET /v1/calendar/events and /www/v1/calendar/events."""
    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    with Session(get_engine()) as session:
        items = _fetch_event_instances(session)
    return json_response(200, {"events": items}, event=event)


def _fetch_event_instances(session: Session) -> list[dict[str, Any]]:
    statement = (
        select(ServiceInstance)
        .join(Service, Service.id == ServiceInstance.service_id)
        .where(Service.service_type == ServiceType.EVENT)
        .where(ServiceInstance.status != InstanceStatus.CANCELLED)
        .options(
            joinedload(ServiceInstance.service),
            joinedload(ServiceInstance.location),
            selectinload(ServiceInstance.session_slots).joinedload(
                ServiceInstance.session_slots.property.mapper.class_.location
            ),
            selectinload(ServiceInstance.ticket_tiers),
        )
        .order_by(ServiceInstance.created_at.desc(), ServiceInstance.id.desc())
    )
    rows = session.execute(statement).unique().scalars().all()
    return [_serialize_public_event(instance) for instance in rows]


def _serialize_public_event(instance: ServiceInstance) -> dict[str, Any]:
    service = instance.service
    title = instance.title if instance.title else service.title
    summary = instance.description if instance.description else service.description

    slots = sorted(instance.session_slots, key=lambda slot: (slot.sort_order, slot.starts_at))
    dates = [
        {
            "id": str(slot.id),
            "start_datetime": _iso(slot.starts_at),
            "end_datetime": _iso(slot.ends_at),
        }
        for slot in slots
    ]

    primary_location = slots[0].location if slots and slots[0].location else instance.location
    location_name = _clean_text(primary_location.name if primary_location else None)
    location_address = _clean_text(primary_location.address if primary_location else None)

    price, currency = _resolve_primary_ticket_price(instance)
    booking_status = "fully_booked" if instance.status == InstanceStatus.FULL else "open"
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
    return payload


def _resolve_primary_ticket_price(instance: ServiceInstance) -> tuple[float | None, str | None]:
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
    resolved = instance.delivery_mode if instance.delivery_mode else service.delivery_mode
    return resolved.value == "online"


def _iso(value: datetime | None) -> str:
    return value.isoformat() if value is not None else ""
