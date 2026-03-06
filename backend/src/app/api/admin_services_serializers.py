"""Serialization helpers for admin services APIs."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.db.models import (
    DiscountCode,
    Enrollment,
    EventTicketTier,
    InstanceSessionSlot,
    Service,
    ServiceInstance,
)


def serialize_service_summary(service: Service) -> dict[str, Any]:
    """Serialize service list row payload."""
    return {
        "id": str(service.id),
        "service_type": service.service_type.value,
        "title": service.title,
        "description": service.description,
        "cover_image_s3_key": service.cover_image_s3_key,
        "delivery_mode": service.delivery_mode.value,
        "status": service.status.value,
        "created_by": service.created_by,
        "created_at": service.created_at.isoformat() if service.created_at else None,
        "updated_at": service.updated_at.isoformat() if service.updated_at else None,
    }


def serialize_service_detail(service: Service) -> dict[str, Any]:
    """Serialize service detail payload with type-specific details."""
    detail = serialize_service_summary(service)
    detail["tag_ids"] = [str(tag.id) for tag in service.tags]
    detail["asset_ids"] = [str(asset.id) for asset in service.assets]
    detail["instances_count"] = len(service.instances)
    detail["training_details"] = None
    detail["event_details"] = None
    detail["consultation_details"] = None
    if service.training_course_details is not None:
        detail["training_details"] = {
            "pricing_unit": service.training_course_details.pricing_unit.value,
            "default_price": _decimal_to_string(
                service.training_course_details.default_price
            ),
            "default_currency": service.training_course_details.default_currency,
        }
    if service.event_details is not None:
        detail["event_details"] = {
            "event_category": service.event_details.event_category.value
        }
    if service.consultation_details is not None:
        detail["consultation_details"] = {
            "consultation_format": service.consultation_details.consultation_format.value,
            "max_group_size": service.consultation_details.max_group_size,
            "duration_minutes": service.consultation_details.duration_minutes,
            "pricing_model": service.consultation_details.pricing_model.value,
            "default_hourly_rate": _decimal_to_string(
                service.consultation_details.default_hourly_rate
            ),
            "default_package_price": _decimal_to_string(
                service.consultation_details.default_package_price
            ),
            "default_package_sessions": service.consultation_details.default_package_sessions,
            "default_currency": service.consultation_details.default_currency,
            "calendly_url": service.consultation_details.calendly_url,
        }
    return detail


def serialize_instance(instance: ServiceInstance) -> dict[str, Any]:
    """Serialize service instance payload."""
    service = instance.service
    resolved_title = instance.title if instance.title is not None else service.title
    resolved_description = (
        instance.description
        if instance.description is not None
        else service.description
    )
    resolved_cover_image_s3_key = (
        instance.cover_image_s3_key
        if instance.cover_image_s3_key is not None
        else service.cover_image_s3_key
    )
    resolved_delivery_mode = (
        instance.delivery_mode.value
        if instance.delivery_mode is not None
        else service.delivery_mode.value
    )
    return {
        "id": str(instance.id),
        "service_id": str(instance.service_id),
        "title": instance.title,
        "description": instance.description,
        "cover_image_s3_key": instance.cover_image_s3_key,
        "status": instance.status.value,
        "delivery_mode": instance.delivery_mode.value
        if instance.delivery_mode
        else None,
        "location_id": str(instance.location_id) if instance.location_id else None,
        "max_capacity": instance.max_capacity,
        "waitlist_enabled": instance.waitlist_enabled,
        "instructor_id": instance.instructor_id,
        "notes": instance.notes,
        "created_by": instance.created_by,
        "created_at": instance.created_at.isoformat() if instance.created_at else None,
        "updated_at": instance.updated_at.isoformat() if instance.updated_at else None,
        "resolved_title": resolved_title,
        "resolved_description": resolved_description,
        "resolved_cover_image_s3_key": resolved_cover_image_s3_key,
        "resolved_delivery_mode": resolved_delivery_mode,
        "session_slots": [
            serialize_session_slot(slot) for slot in instance.session_slots
        ],
        "training_details": (
            {
                "training_format": instance.training_details.training_format.value,
                "price": _decimal_to_string(instance.training_details.price),
                "currency": instance.training_details.currency,
                "pricing_unit": instance.training_details.pricing_unit.value,
            }
            if instance.training_details is not None
            else None
        ),
        "event_ticket_tiers": [
            serialize_event_ticket_tier(tier) for tier in instance.ticket_tiers
        ],
        "consultation_details": (
            {
                "pricing_model": instance.consultation_details.pricing_model.value,
                "price": _decimal_to_string(instance.consultation_details.price),
                "currency": instance.consultation_details.currency,
                "package_sessions": instance.consultation_details.package_sessions,
                "calendly_event_url": instance.consultation_details.calendly_event_url,
            }
            if instance.consultation_details is not None
            else None
        ),
    }


def serialize_session_slot(slot: InstanceSessionSlot) -> dict[str, Any]:
    """Serialize one session slot."""
    return {
        "id": str(slot.id),
        "instance_id": str(slot.instance_id),
        "location_id": str(slot.location_id) if slot.location_id else None,
        "starts_at": slot.starts_at.isoformat() if slot.starts_at else None,
        "ends_at": slot.ends_at.isoformat() if slot.ends_at else None,
        "sort_order": slot.sort_order,
    }


def serialize_event_ticket_tier(tier: EventTicketTier) -> dict[str, Any]:
    """Serialize one event ticket tier."""
    return {
        "id": str(tier.id),
        "instance_id": str(tier.instance_id),
        "name": tier.name,
        "description": tier.description,
        "price": _decimal_to_string(tier.price),
        "currency": tier.currency,
        "max_quantity": tier.max_quantity,
        "sort_order": tier.sort_order,
    }


def serialize_enrollment(enrollment: Enrollment) -> dict[str, Any]:
    """Serialize enrollment payload."""
    return {
        "id": str(enrollment.id),
        "instance_id": str(enrollment.instance_id),
        "contact_id": str(enrollment.contact_id) if enrollment.contact_id else None,
        "family_id": str(enrollment.family_id) if enrollment.family_id else None,
        "organization_id": str(enrollment.organization_id)
        if enrollment.organization_id
        else None,
        "ticket_tier_id": str(enrollment.ticket_tier_id)
        if enrollment.ticket_tier_id
        else None,
        "discount_code_id": str(enrollment.discount_code_id)
        if enrollment.discount_code_id
        else None,
        "status": enrollment.status.value,
        "amount_paid": _decimal_to_string(enrollment.amount_paid),
        "currency": enrollment.currency,
        "enrolled_at": enrollment.enrolled_at.isoformat()
        if enrollment.enrolled_at
        else None,
        "cancelled_at": enrollment.cancelled_at.isoformat()
        if enrollment.cancelled_at
        else None,
        "notes": enrollment.notes,
        "created_by": enrollment.created_by,
        "created_at": enrollment.created_at.isoformat()
        if enrollment.created_at
        else None,
        "updated_at": enrollment.updated_at.isoformat()
        if enrollment.updated_at
        else None,
    }


def serialize_discount_code(code: DiscountCode) -> dict[str, Any]:
    """Serialize discount-code payload."""
    return {
        "id": str(code.id),
        "code": code.code,
        "description": code.description,
        "discount_type": code.discount_type.value,
        "discount_value": _decimal_to_string(code.discount_value),
        "currency": code.currency,
        "valid_from": code.valid_from.isoformat() if code.valid_from else None,
        "valid_until": code.valid_until.isoformat() if code.valid_until else None,
        "service_id": str(code.service_id) if code.service_id else None,
        "instance_id": str(code.instance_id) if code.instance_id else None,
        "max_uses": code.max_uses,
        "current_uses": code.current_uses,
        "active": code.active,
        "created_by": code.created_by,
        "created_at": code.created_at.isoformat() if code.created_at else None,
        "updated_at": code.updated_at.isoformat() if code.updated_at else None,
    }


def _decimal_to_string(value: Decimal | None) -> str | None:
    return str(value) if value is not None else None
