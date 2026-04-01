from __future__ import annotations

import pytest

from app.api.admin_validators import (
    parse_optional_service_instance_slug,
    validate_email,
    validate_string_length,
)
from app.exceptions import ValidationError


def test_validate_string_length_rejects_missing_required_values() -> None:
    with pytest.raises(ValidationError, match="title is required"):
        validate_string_length(None, "title", max_length=10, required=True)


def test_validate_string_length_rejects_values_over_max_length() -> None:
    with pytest.raises(ValidationError, match="title must be at most 5 characters"):
        validate_string_length("toolong", "title", max_length=5)


def test_validate_email_normalizes_case() -> None:
    assert validate_email("ADMIN@EXAMPLE.COM") == "admin@example.com"


def test_parse_optional_service_instance_slug_normalizes_and_validates() -> None:
    assert parse_optional_service_instance_slug("  Spring-Workshop  ") == "spring-workshop"
    assert parse_optional_service_instance_slug(None) is None
    assert parse_optional_service_instance_slug("   ") is None


def test_parse_optional_service_instance_slug_rejects_invalid() -> None:
    with pytest.raises(ValidationError, match="lowercase letters"):
        parse_optional_service_instance_slug("Bad_Slug")
    with pytest.raises(ValidationError, match="lowercase letters"):
        parse_optional_service_instance_slug("double--hyphen")
