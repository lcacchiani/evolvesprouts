"""Booking instance slug generation for public reservations."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.api.public_reservations import _generate_booking_instance_slug
from app.exceptions import ValidationError


def test_generate_booking_instance_slug_matches_pattern_and_length() -> None:
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    slug = _generate_booking_instance_slug(
        template_slug="consultation-essentials-package",
        now_utc=now,
    )
    assert len(slug) <= 128
    parts = slug.split("-")
    assert len(parts) >= 3
    assert parts[-1].isalnum()
    assert parts[-2].isdigit()


def test_generate_booking_instance_slug_truncates_long_template() -> None:
    long_template = "x" * 120
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    slug = _generate_booking_instance_slug(template_slug=long_template, now_utc=now)
    assert len(slug) == 128


def test_generate_booking_instance_slug_rejects_invalid_composition() -> None:
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    with pytest.raises(ValidationError) as exc:
        _generate_booking_instance_slug(template_slug="bad_slug_", now_utc=now)
    assert getattr(exc.value, "field", None) == "serviceInstanceSlug"
