"""Booking instance slug generation for public reservations."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import secrets

import pytest
from sqlalchemy.exc import IntegrityError

from app.api.public_reservations import (
    _create_booking_instance_for_template,
    _generate_booking_instance_slug,
)
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


def test_generate_booking_instance_slug_changes_when_token_hex_changes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Second slug differs when ``secrets.token_hex`` yields a new suffix (collision retry path)."""
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    tokens = iter(["aaaaaaaa", "bbbbbbbb"])
    monkeypatch.setattr(secrets, "token_hex", lambda nbytes=4: next(tokens))
    first = _generate_booking_instance_slug(template_slug="consult-tier", now_utc=now)
    second = _generate_booking_instance_slug(template_slug="consult-tier", now_utc=now)
    assert first != second


def test_create_booking_instance_for_template_retries_after_integrity_error() -> None:
    template_id = uuid4()
    svc_id = uuid4()
    locked = SimpleNamespace(
        id=template_id,
        slug="intro-call-free-15min",
        title="Intro",
        service_id=svc_id,
        delivery_mode=MagicMock(),
        location_id=None,
        instructor_id=None,
    )
    calls = {"n": 0}

    class _FakeRepo:
        def lock_template_for_booking(self, tid: object) -> object:
            assert tid == template_id
            return locked

        def create_instance(
            self, booking: object, type_details=None, session_slots=None
        ):
            calls["n"] += 1
            if calls["n"] == 1:
                raise IntegrityError("stmt", {}, Exception("dup slug"))
            booking.id = uuid4()
            return booking

    class _Nested:
        def __enter__(self) -> None:
            return None

        def __exit__(self, *_args: object) -> bool:
            return False

    class _FakeSession:
        def begin_nested(self) -> _Nested:
            return _Nested()

    out = _create_booking_instance_for_template(
        _FakeSession(),
        _FakeRepo(),
        SimpleNamespace(id=template_id),
        {"attendee_name": "Pat"},
        now_utc=datetime(2026, 5, 6, tzinfo=UTC),
    )
    assert calls["n"] == 2
    assert getattr(out, "id", None) is not None


def test_create_booking_instance_for_template_raises_after_three_integrity_errors() -> (
    None
):
    template_id = uuid4()
    locked = SimpleNamespace(
        id=template_id,
        slug="intro-call-free-15min",
        title="Intro",
        service_id=uuid4(),
        delivery_mode=MagicMock(),
        location_id=None,
        instructor_id=None,
    )

    class _FakeRepo:
        def lock_template_for_booking(self, tid: object) -> object:
            return locked

        def create_instance(
            self, _booking: object, type_details=None, session_slots=None
        ):
            raise IntegrityError("stmt", {}, Exception("dup slug"))

    class _Nested:
        def __enter__(self) -> None:
            return None

        def __exit__(self, *_args: object) -> bool:
            return False

    class _FakeSession:
        def begin_nested(self) -> _Nested:
            return _Nested()

    with pytest.raises(ValidationError) as excinfo:
        _create_booking_instance_for_template(
            _FakeSession(),
            _FakeRepo(),
            SimpleNamespace(id=template_id),
            {"attendee_name": "Pat"},
            now_utc=datetime(2026, 5, 6, tzinfo=UTC),
        )
    assert excinfo.value.status_code == 500
