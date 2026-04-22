"""Tests for optional ``booking_system`` field on admin service payloads."""

from __future__ import annotations

import pytest

from app.api.admin_services_payloads import parse_optional_booking_system
from app.exceptions import ValidationError


def test_parse_optional_booking_system_strips_and_none_for_blank() -> None:
    assert parse_optional_booking_system(None, "booking_system") is None
    assert parse_optional_booking_system("   ", "booking_system") is None
    assert parse_optional_booking_system("  calendly  ", "booking_system") == "calendly"


def test_parse_optional_booking_system_rejects_non_string() -> None:
    with pytest.raises(ValidationError, match="must be a string"):
        parse_optional_booking_system(123, "booking_system")


def test_parse_optional_booking_system_max_length() -> None:
    ok = "a" * 80
    assert parse_optional_booking_system(ok, "booking_system") == ok
    with pytest.raises(ValidationError, match="at most 80"):
        parse_optional_booking_system("a" * 81, "booking_system")
