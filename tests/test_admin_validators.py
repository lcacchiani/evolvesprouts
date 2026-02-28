from __future__ import annotations

import pytest

from app.api.admin_validators import validate_email, validate_string_length
from app.exceptions import ValidationError


def test_validate_string_length_rejects_missing_required_values() -> None:
    with pytest.raises(ValidationError, match="title is required"):
        validate_string_length(None, "title", max_length=10, required=True)


def test_validate_string_length_rejects_values_over_max_length() -> None:
    with pytest.raises(ValidationError, match="title must be at most 5 characters"):
        validate_string_length("toolong", "title", max_length=5)


def test_validate_email_normalizes_case() -> None:
    assert validate_email("ADMIN@EXAMPLE.COM") == "admin@example.com"
