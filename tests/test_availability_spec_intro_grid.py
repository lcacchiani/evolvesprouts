"""Intro-call availability spec must not expose a fake grid-alignment predicate (L1)."""

from __future__ import annotations

from app.services.public_calendar_availability import (
    AvailabilityPurpose,
    _PUBLIC_AVAILABILITY_SPECS,
)


def test_intro_call_booking_spec_has_no_grid_alignment_predicate() -> None:
    spec = _PUBLIC_AVAILABILITY_SPECS[AvailabilityPurpose.INTRO_CALL_BOOKING]
    assert spec.is_grid_aligned_local is None
