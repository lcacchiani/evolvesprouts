"""Tests for public calendar query parameter parsing helpers."""

from __future__ import annotations

from app.api import public_events


def test_parse_service_key_none() -> None:
    assert public_events._parse_service_key(None) is None


def test_parse_service_key_trims_and_lowercases() -> None:
    assert public_events._parse_service_key("  My-Best-Auntie  ") == "my-best-auntie"


def test_parse_service_key_invalid_pattern() -> None:
    assert public_events._parse_service_key("Invalid.Slug") is None


def test_parse_service_key_too_long() -> None:
    raw = "a" * 81
    assert public_events._parse_service_key(raw) is None


def test_parse_service_key_blank_and_whitespace_only() -> None:
    assert public_events._parse_service_key("") is None
    assert public_events._parse_service_key("   ") is None


def test_parse_service_key_valid_slug() -> None:
    assert public_events._parse_service_key("my-best-auntie") == "my-best-auntie"
