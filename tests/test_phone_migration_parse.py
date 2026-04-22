"""Tests for legacy phone parsing used in migration 0033."""

from __future__ import annotations

from app.utils.legacy_phone_migration import parse_legacy_contact_phone_for_migration


def test_migration_parse_e164() -> None:
    r, n = parse_legacy_contact_phone_for_migration("+852 9123 4567")  # type: ignore[assignment]
    assert r == "HK"
    assert n == "91234567"


def test_migration_parse_legacy_importer_hyphen_form() -> None:
    r, n = parse_legacy_contact_phone_for_migration("+852-98765432")  # type: ignore[assignment]
    assert r == "HK"
    assert n == "98765432"


def test_migration_parse_default_region() -> None:
    r, n = parse_legacy_contact_phone_for_migration("91234567")  # type: ignore[assignment]
    assert r == "HK"
    assert n == "91234567"


def test_migration_parse_possible_but_not_strictly_valid_still_stored() -> None:
    """Backfill uses is_possible_number; same digits must format on read."""
    from app.utils.phone import format_phone_e164

    r, n = parse_legacy_contact_phone_for_migration("90000000")  # type: ignore[assignment]
    assert r == "HK"
    assert n == "90000000"
    assert format_phone_e164(r, n) == "+85290000000"
