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
    _create_booking_instance_for_service,
    _generate_booking_instance_slug,
)
from app.exceptions import ValidationError


def test_generate_booking_instance_slug_matches_pattern_and_length() -> None:
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    slug = _generate_booking_instance_slug(
        service_key="family-consultation-essentials",
        now_utc=now,
    )
    assert len(slug) <= 128
    parts = slug.split("-")
    assert len(parts) >= 4
    assert parts[-1].isalnum()
    assert parts[-2].isdigit()


def test_generate_booking_instance_slug_truncates_long_template() -> None:
    long_key = "x" * 120
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    slug = _generate_booking_instance_slug(service_key=long_key, now_utc=now)
    assert len(slug) == 128


def test_generate_booking_instance_slug_rejects_invalid_composition() -> None:
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    with pytest.raises(ValidationError) as exc:
        _generate_booking_instance_slug(service_key="bad_slug_", now_utc=now)
    assert getattr(exc.value, "field", None) == "serviceInstanceSlug"


def test_generate_booking_instance_slug_changes_when_token_hex_changes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Second slug differs when ``secrets.token_hex`` yields a new suffix (collision retry path)."""
    now = datetime(2026, 5, 6, 8, 15, 30, tzinfo=UTC)
    tokens = iter(["aaaaaaaa", "bbbbbbbb"])
    monkeypatch.setattr(secrets, "token_hex", lambda nbytes=4: next(tokens))
    first = _generate_booking_instance_slug(service_key="consult-tier", now_utc=now)
    second = _generate_booking_instance_slug(service_key="consult-tier", now_utc=now)
    assert first != second


def test_create_booking_instance_for_service_retries_after_integrity_error() -> None:
    svc_id = uuid4()
    locked = SimpleNamespace(
        id=svc_id,
        service_key="intro-call",
        title="Intro",
        delivery_mode=MagicMock(),
        location_id=None,
    )
    calls = {"n": 0}

    class _FakeRepo:
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

    class _FakeExec:
        def scalar_one_or_none(self) -> object:
            return locked

    class _FakeSession:
        def execute(self, _stmt: object) -> _FakeExec:
            return _FakeExec()

        def begin_nested(self) -> _Nested:
            return _Nested()

    out = _create_booking_instance_for_service(
        _FakeSession(),
        _FakeRepo(),
        locked,
        {"attendee_name": "Pat"},
        now_utc=datetime(2026, 5, 6, tzinfo=UTC),
    )
    assert calls["n"] == 2
    assert getattr(out, "id", None) is not None


def test_create_booking_instance_for_service_raises_after_three_integrity_errors() -> (
    None
):
    svc_id = uuid4()
    locked = SimpleNamespace(
        id=svc_id,
        service_key="intro-call",
        title="Intro",
        delivery_mode=MagicMock(),
        location_id=None,
    )

    class _FakeRepo:
        def create_instance(
            self, _booking: object, type_details=None, session_slots=None
        ):
            raise IntegrityError("stmt", {}, Exception("dup slug"))

    class _Nested:
        def __enter__(self) -> None:
            return None

        def __exit__(self, *_args: object) -> bool:
            return False

    class _FakeExec:
        def scalar_one_or_none(self) -> object:
            return locked

    class _FakeSession:
        def execute(self, _stmt: object) -> _FakeExec:
            return _FakeExec()

        def begin_nested(self) -> _Nested:
            return _Nested()

    with pytest.raises(ValidationError) as excinfo:
        _create_booking_instance_for_service(
            _FakeSession(),
            _FakeRepo(),
            locked,
            {"attendee_name": "Pat"},
            now_utc=datetime(2026, 5, 6, tzinfo=UTC),
        )
    assert excinfo.value.status_code == 500
