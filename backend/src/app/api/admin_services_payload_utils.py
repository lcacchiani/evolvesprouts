"""Low-level parsing helpers for admin services payloads."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, TypeVar
from uuid import UUID

from app.api.admin_validators import (
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    validate_string_length,
)
from app.db.models import (
    ConsultationFormat,
    ConsultationPricingModel,
    EventCategory,
    ServiceType,
    TrainingFormat,
    TrainingPricingUnit,
)
from app.exceptions import ValidationError
from app.utils.logging import get_logger

_MAX_CURRENCY_LENGTH = 3

EnumType = TypeVar("EnumType")
logger = get_logger(__name__)


def parse_service_type_details(
    service_type: ServiceType, body: Mapping[str, Any]
) -> dict[str, Any]:
    """Parse service type-specific details."""
    logger.debug(
        "Parsing service type details",
        extra={"service_type": service_type.value},
    )
    if service_type == ServiceType.TRAINING_COURSE:
        source = extract_obj(body, "training_details")
        return {
            "pricing_unit": parse_optional_enum(
                source.get("pricing_unit") or body.get("pricing_unit"),
                TrainingPricingUnit,
                "pricing_unit",
            )
            or TrainingPricingUnit.PER_PERSON,
            "default_price": parse_optional_decimal(
                source.get("default_price")
                if "default_price" in source
                else body.get("default_price"),
                "default_price",
            ),
            "default_currency": parse_optional_currency(
                source.get("default_currency")
                if "default_currency" in source
                else body.get("default_currency"),
                "default_currency",
            )
            or "HKD",
        }
    if service_type == ServiceType.EVENT:
        source = extract_obj(body, "event_details")
        return {
            "event_category": parse_required_enum(
                source.get("event_category") or body.get("event_category"),
                EventCategory,
                "event_category",
            ),
            "default_price": parse_optional_decimal(
                source.get("default_price")
                if "default_price" in source
                else body.get("default_price"),
                "default_price",
            ),
            "default_currency": parse_optional_currency(
                source.get("default_currency")
                if "default_currency" in source
                else body.get("default_currency"),
                "default_currency",
            )
            or "HKD",
        }

    source = extract_obj(body, "consultation_details")
    duration_minutes = parse_optional_int(
        source.get("duration_minutes")
        if "duration_minutes" in source
        else body.get("duration_minutes"),
        "duration_minutes",
        minimum=1,
    )
    if duration_minutes is None:
        raise ValidationError(
            "duration_minutes is required for consultation services",
            field="duration_minutes",
        )
    return {
        "consultation_format": parse_required_enum(
            source.get("consultation_format") or body.get("consultation_format"),
            ConsultationFormat,
            "consultation_format",
        ),
        "max_group_size": parse_optional_int(
            source.get("max_group_size")
            if "max_group_size" in source
            else body.get("max_group_size"),
            "max_group_size",
            minimum=1,
        ),
        "duration_minutes": duration_minutes,
        "pricing_model": parse_optional_enum(
            source.get("pricing_model") or body.get("pricing_model"),
            ConsultationPricingModel,
            "pricing_model",
        )
        or ConsultationPricingModel.FREE,
        "default_hourly_rate": parse_optional_decimal(
            source.get("default_hourly_rate")
            if "default_hourly_rate" in source
            else body.get("default_hourly_rate"),
            "default_hourly_rate",
        ),
        "default_package_price": parse_optional_decimal(
            source.get("default_package_price")
            if "default_package_price" in source
            else body.get("default_package_price"),
            "default_package_price",
        ),
        "default_package_sessions": parse_optional_int(
            source.get("default_package_sessions")
            if "default_package_sessions" in source
            else body.get("default_package_sessions"),
            "default_package_sessions",
            minimum=1,
        ),
        "default_currency": parse_optional_currency(
            source.get("default_currency")
            if "default_currency" in source
            else body.get("default_currency"),
            "default_currency",
        )
        or "HKD",
    }


def parse_instance_type_details(
    service_type: ServiceType, body: Mapping[str, Any]
) -> dict[str, Any]:
    """Parse instance type-specific details."""
    logger.debug(
        "Parsing instance type details",
        extra={"service_type": service_type.value},
    )
    if service_type == ServiceType.TRAINING_COURSE:
        source = extract_obj(body, "training_details")
        return {
            "training_format": parse_required_enum(
                source.get("training_format") or body.get("training_format"),
                TrainingFormat,
                "training_format",
            ),
            "price": parse_required_decimal(
                source.get("price") if "price" in source else body.get("price"),
                "price",
            ),
            "currency": parse_optional_currency(
                source.get("currency")
                if "currency" in source
                else body.get("currency"),
                "currency",
            )
            or "HKD",
            "pricing_unit": parse_optional_enum(
                source.get("pricing_unit")
                if "pricing_unit" in source
                else body.get("pricing_unit"),
                TrainingPricingUnit,
                "pricing_unit",
            )
            or TrainingPricingUnit.PER_PERSON,
        }
    if service_type == ServiceType.EVENT:
        tiers_value = body.get("event_ticket_tiers")
        if tiers_value is None:
            return {"event_ticket_tiers": []}
        if not isinstance(tiers_value, list):
            raise ValidationError(
                "event_ticket_tiers must be an array",
                field="event_ticket_tiers",
            )
        tiers: list[dict[str, Any]] = []
        for idx, entry in enumerate(tiers_value):
            if not isinstance(entry, Mapping):
                raise ValidationError(
                    f"event_ticket_tiers[{idx}] must be an object",
                    field="event_ticket_tiers",
                )
            name_raw = parse_optional_text(entry.get("name"), max_length=100)
            tiers.append(
                {
                    "name": (name_raw or "").strip(),
                    "description": parse_optional_text(
                        entry.get("description"), max_length=MAX_DESCRIPTION_LENGTH
                    ),
                    "price": parse_optional_decimal(entry.get("price"), "price"),
                    "currency": parse_optional_currency(
                        entry.get("currency"), "currency"
                    ),
                    "max_quantity": parse_optional_int(
                        entry.get("max_quantity"), "max_quantity", minimum=1
                    ),
                    "sort_order": parse_optional_int(
                        entry.get("sort_order"), "sort_order", minimum=0
                    )
                    or idx,
                }
            )
        return {"event_ticket_tiers": tiers}
    source = extract_obj(body, "consultation_details")
    return {
        "pricing_model": parse_optional_enum(
            source.get("pricing_model") or body.get("pricing_model"),
            ConsultationPricingModel,
            "pricing_model",
        )
        or ConsultationPricingModel.FREE,
        "price": parse_optional_decimal(
            source.get("price") if "price" in source else body.get("price"),
            "price",
        ),
        "currency": parse_optional_currency(
            source.get("currency") if "currency" in source else body.get("currency"),
            "currency",
        )
        or "HKD",
        "package_sessions": parse_optional_int(
            source.get("package_sessions")
            if "package_sessions" in source
            else body.get("package_sessions"),
            "package_sessions",
            minimum=1,
        ),
    }


def parse_session_slots(value: Any) -> list[dict[str, Any]]:
    """Parse and validate session-slot payload list."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError("session_slots must be an array", field="session_slots")
    slots: list[dict[str, Any]] = []
    for idx, entry in enumerate(value):
        if not isinstance(entry, Mapping):
            raise ValidationError(
                f"session_slots[{idx}] must be an object",
                field="session_slots",
            )
        starts_at = parse_optional_datetime(entry.get("starts_at"), "starts_at")
        ends_at = parse_optional_datetime(entry.get("ends_at"), "ends_at")
        if starts_at is None or ends_at is None:
            raise ValidationError(
                "starts_at and ends_at are required for each session slot",
                field="session_slots",
            )
        if ends_at <= starts_at:
            raise ValidationError(
                "ends_at must be after starts_at", field="session_slots"
            )
        slots.append(
            {
                "location_id": parse_optional_uuid(
                    entry.get("location_id"), "location_id"
                ),
                "starts_at": starts_at,
                "ends_at": ends_at,
                "sort_order": parse_optional_int(
                    entry.get("sort_order"), "sort_order", minimum=0
                )
                or idx,
            }
        )
    return slots


def parse_required_text(value: Any, field: str, *, max_length: int) -> str:
    parsed = validate_string_length(value, field, max_length=max_length, required=True)
    if parsed is None:
        raise ValidationError(f"{field} is required", field=field)
    return parsed


def parse_optional_text(value: Any, *, max_length: int = MAX_NAME_LENGTH) -> str | None:
    return validate_string_length(value, "text", max_length=max_length, required=False)


def parse_optional_uuid(value: Any, field: str) -> UUID | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return UUID(str(value).strip())
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"{field} must be a valid UUID", field=field) from exc


def parse_uuid_list(value: Any, field: str) -> list[UUID]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError(f"{field} must be a list of UUID strings", field=field)
    parsed: list[UUID] = []
    for idx, entry in enumerate(value):
        parsed_value = parse_optional_uuid(entry, f"{field}[{idx}]")
        if parsed_value is not None:
            parsed.append(parsed_value)
    return parsed


def parse_required_enum(value: Any, enum_cls: type[EnumType], field: str) -> EnumType:
    if value is None:
        raise ValidationError(f"{field} is required", field=field)
    try:
        return enum_cls(str(value).strip().lower())  # type: ignore[call-arg]
    except ValueError as exc:
        raise ValidationError(f"Invalid value for {field}", field=field) from exc


def parse_optional_enum(
    value: Any, enum_cls: type[EnumType], field: str
) -> EnumType | None:
    if value is None or str(value).strip() == "":
        return None
    return parse_required_enum(value, enum_cls, field)


def parse_optional_int(
    value: Any, field: str, *, minimum: int | None = None
) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be an integer", field=field) from exc
    if minimum is not None and parsed < minimum:
        raise ValidationError(f"{field} must be >= {minimum}", field=field)
    return parsed


def parse_required_bool(value: Any, field: str) -> bool:
    parsed = parse_optional_bool(value, field)
    if parsed is None:
        raise ValidationError(f"{field} is required", field=field)
    return parsed


def parse_optional_bool(value: Any, field: str) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    raise ValidationError(f"{field} must be true or false", field=field)


def parse_optional_datetime(value: Any, field: str) -> datetime | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(
            f"{field} must be a valid ISO datetime", field=field
        ) from exc
    return normalize_datetime(parsed)


def parse_optional_decimal(value: Any, field: str) -> Decimal | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError(f"{field} must be a valid decimal", field=field) from exc
    return parsed


def parse_required_decimal(value: Any, field: str) -> Decimal:
    parsed = parse_optional_decimal(value, field)
    if parsed is None:
        raise ValidationError(f"{field} is required", field=field)
    if parsed <= Decimal("0"):
        raise ValidationError(f"{field} must be greater than 0", field=field)
    return parsed


_EXTERNAL_URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)


def parse_optional_external_url(value: Any, field: str) -> str | None:
    """Parse optional external URL: trim, max 500, http(s) only."""
    if value is None or str(value).strip() == "":
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string", field=field)
    trimmed = value.strip()
    if len(trimmed) > 500:
        raise ValidationError(f"{field} must be at most 500 characters", field=field)
    if not _EXTERNAL_URL_PATTERN.match(trimmed):
        raise ValidationError(
            f"{field} must start with http:// or https://",
            field=field,
        )
    return trimmed


def parse_required_non_negative_decimal(value: Any, field: str) -> Decimal:
    """Parse a required decimal that may be zero (used where referral allows 0)."""
    parsed = parse_optional_decimal(value, field)
    if parsed is None:
        raise ValidationError(f"{field} is required", field=field)
    if parsed < Decimal("0"):
        raise ValidationError(f"{field} must be >= 0", field=field)
    return parsed


def parse_optional_currency(value: Any, field: str) -> str | None:
    parsed = parse_optional_text(value, max_length=_MAX_CURRENCY_LENGTH)
    if parsed is None:
        return None
    normalized = parsed.upper()
    if len(normalized) != 3:
        raise ValidationError(f"{field} must be a 3-letter ISO code", field=field)
    return normalized


def extract_obj(body: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = body.get(key)
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise ValidationError(f"{key} must be an object", field=key)
    return value


def has_field(body: Mapping[str, Any], key: str) -> bool:
    return key in body


def has_any_field(body: Mapping[str, Any], *keys: str) -> bool:
    return any(key in body for key in keys)


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
