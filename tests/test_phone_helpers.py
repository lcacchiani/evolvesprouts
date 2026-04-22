"""Tests for phone validation, formatting, and admin contact search predicates."""

from __future__ import annotations

import pytest

from app.api.admin_validators import validate_phone_fields, validate_phone_region
from app.db.repositories.contact import _phone_search_predicates
from app.exceptions import ValidationError
from app.utils.phone import (
    country_calling_codes_longest_first,
    format_phone_e164,
    format_phone_international,
    strip_phone_search_term,
    try_parse_international_digit_string,
)


def test_validate_phone_region_uppercases() -> None:
    assert validate_phone_region(" hk ") == "HK"


def test_validate_phone_region_invalid() -> None:
    with pytest.raises(ValidationError):
        validate_phone_region("XX")


def test_validate_phone_fields_hk() -> None:
    r, n = validate_phone_fields("HK", "91234567")
    assert r == "HK"
    assert n == "91234567"


def test_validate_phone_fields_rejects_non_digit_input() -> None:
    with pytest.raises(ValidationError):
        validate_phone_fields("HK", "9123 4567")


def test_validate_phone_fields_requires_pair() -> None:
    with pytest.raises(ValidationError):
        validate_phone_fields("HK", None)


def test_format_phone_e164_and_international() -> None:
    assert format_phone_e164("HK", "91234567") == "+85291234567"
    assert format_phone_international("HK", "91234567") is not None


def test_format_phone_e164_accepts_possible_not_only_valid() -> None:
    """Align read-time formatting with migration soft gate (possible numbers)."""
    assert format_phone_e164("HK", "90000000") == "+85290000000"
    assert format_phone_international("HK", "90000000") is not None


def test_strip_phone_search_term() -> None:
    assert strip_phone_search_term(" +852 9123 ") == "+8529123"


def test_try_parse_international_digit_string() -> None:
    out = try_parse_international_digit_string("85291234567")
    assert out is not None
    assert out[0] == "HK"


def test_country_calling_codes_longest_first_order() -> None:
    codes = country_calling_codes_longest_first()
    assert codes[0] >= codes[1]


def test_phone_search_predicates_plus_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_PHONE_REGION", "HK")
    preds = _phone_search_predicates("+8529123")
    assert len(preds) >= 1


def test_phone_search_predicates_short_digits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_PHONE_REGION", "HK")
    preds = _phone_search_predicates("123")
    assert len(preds) == 1
