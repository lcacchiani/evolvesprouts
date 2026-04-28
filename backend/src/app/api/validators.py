"""Shared HTTP payload validation helpers."""

from __future__ import annotations

import re
from typing import Any

from app.exceptions import ValidationError

MAX_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000
MAX_ADDRESS_LENGTH = 500
MAX_EMAIL_LENGTH = 320
MAX_PHONE_REGION_LENGTH = 2
MAX_PHONE_NUMBER_LENGTH = 20
MAX_SOCIAL_HANDLE_LENGTH = 64

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_string_length(
    value: Any,
    field_name: str,
    max_length: int,
    required: bool = False,
) -> str | None:
    """Validate and sanitize a string input."""
    if value is None:
        if required:
            raise ValidationError(f"{field_name} is required", field=field_name)
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    if not value:
        if required:
            raise ValidationError(f"{field_name} is required", field=field_name)
        return None
    if len(value) > max_length:
        raise ValidationError(
            f"{field_name} must be at most {max_length} characters",
            field=field_name,
        )
    return value


def validate_email(value: Any) -> str | None:
    """Validate email address."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError("email must be a string", field="email")
    value = value.strip().lower()
    if not value:
        return None
    if len(value) > MAX_EMAIL_LENGTH:
        raise ValidationError(
            f"email must be at most {MAX_EMAIL_LENGTH} characters",
            field="email",
        )
    if not EMAIL_RE.match(value):
        raise ValidationError("email must be a valid email address", field="email")
    return value


def validate_phone_region(value: Any) -> str | None:
    """Validate ISO 3166-1 alpha-2 region code for phone parsing (upper-case)."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError("phone_region must be a string", field="phone_region")
    value = value.strip().upper()
    if not value:
        return None
    if len(value) != MAX_PHONE_REGION_LENGTH:
        raise ValidationError(
            "phone_region must be 2 characters",
            field="phone_region",
        )

    import phonenumbers

    if value not in phonenumbers.SUPPORTED_REGIONS:
        raise ValidationError(
            "phone_region must be a valid ISO 3166-1 alpha-2 region code",
            field="phone_region",
        )
    return value


def validate_phone_fields(
    phone_region: Any, phone_number: Any
) -> tuple[str | None, str | None]:
    """Validate phone_region + phone_number; return (region upper, national digits only)."""
    if phone_region is None and phone_number is None:
        return None, None

    if phone_region is None:
        raise ValidationError("phone_region is required", field="phone_region")
    if phone_number is None:
        raise ValidationError("phone_number is required", field="phone_number")

    region = validate_phone_region(phone_region)
    if region is None:
        raise ValidationError("phone_region is required", field="phone_region")

    if not isinstance(phone_number, str):
        raise ValidationError("phone_number must be a string", field="phone_number")
    number = phone_number.strip()
    normalized_number = re.sub(r"\D", "", number)
    if not number:
        raise ValidationError("phone_number is required", field="phone_number")
    if number != normalized_number:
        raise ValidationError(
            "phone_number must contain digits only (no spaces or punctuation)",
            field="phone_number",
        )
    if len(normalized_number) > MAX_PHONE_NUMBER_LENGTH:
        raise ValidationError(
            f"phone_number must be at most {MAX_PHONE_NUMBER_LENGTH} digits",
            field="phone_number",
        )

    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException

    try:
        parsed = phonenumbers.parse(normalized_number, region)
    except NumberParseException as exc:
        raise ValidationError(
            "phone_number must be a valid number",
            field="phone_number",
        ) from exc

    if not phonenumbers.is_valid_number(parsed):
        raise ValidationError(
            "phone_number is not valid for phone_region",
            field="phone_number",
        )

    national_number = phonenumbers.national_significant_number(parsed)
    return region, national_number
