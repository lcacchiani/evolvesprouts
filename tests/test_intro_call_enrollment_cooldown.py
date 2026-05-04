"""Unit tests for intro-call enrollment-based cooldown lookup."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.intro_call_slots import (
    intro_call_cooldown_blocks_from_created_at,
    recent_intro_call_enrollment_created_at,
)


class _ScalarResult:
    def __init__(self, value: datetime | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> datetime | None:
        return self._value


class _FakeSession:
    def __init__(self, created_at: datetime | None) -> None:
        self._created_at = created_at

    def execute(self, _stmt: object) -> _ScalarResult:
        return _ScalarResult(self._created_at)


def test_recent_intro_call_enrollment_created_at_none_when_no_booking() -> None:
    assert (
        recent_intro_call_enrollment_created_at(
            _FakeSession(None),
            email_lower="p@example.com",
            within_days=30,
            now=datetime.now(tz=UTC),
        )
        is None
    )


def test_recent_intro_call_enrollment_created_at_returns_prior_timestamp() -> None:
    prior = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    assert (
        recent_intro_call_enrollment_created_at(
            _FakeSession(prior),
            email_lower="p@example.com",
            within_days=30,
            now=datetime.now(tz=UTC),
        )
        == prior
    )


def test_cooldown_blocks_within_30_days_from_created_at() -> None:
    prior = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    now = prior + timedelta(days=5)
    assert intro_call_cooldown_blocks_from_created_at(prior_created_at=prior, now=now) is True


def test_cooldown_expired_after_31_days_from_created_at() -> None:
    prior = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    now = prior + timedelta(days=31)
    assert intro_call_cooldown_blocks_from_created_at(prior_created_at=prior, now=now) is False


def test_cooldown_does_not_cross_contaminate_two_contacts_via_mock() -> None:
    """Each session returns only that contact's last enrollment; no Cartesian join."""
    s_a = _FakeSession(datetime(2026, 5, 10, 0, 0, tzinfo=UTC))
    s_b = _FakeSession(datetime(2026, 5, 28, 0, 0, tzinfo=UTC))
    a_ts = recent_intro_call_enrollment_created_at(
        s_a, email_lower="a@example.com", within_days=30, now=datetime(2026, 6, 1, tzinfo=UTC)
    )
    b_ts = recent_intro_call_enrollment_created_at(
        s_b, email_lower="b@example.com", within_days=30, now=datetime(2026, 6, 1, tzinfo=UTC)
    )
    assert a_ts != b_ts


def test_contact_upsert_does_not_overwrite_reservation_source_json_on_second_call() -> None:
    """Regression: intro-call JSON source_detail must not replace prior reservation JSON."""
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from app.db.models.enums import ContactSource, ContactType
    from app.db.repositories.contact import ContactRepository

    session = MagicMock()
    repo = ContactRepository(session)
    first_json = '{"source":"public-www-booking","utm_source":"google"}'
    second_json = '{"source":"public-www-booking","utm_source":"meta"}'
    stored = SimpleNamespace(
        email="x@example.com",
        first_name="Pat",
        source=ContactSource.RESERVATION,
        source_detail=first_json,
    )

    def _fake_find(_email: str) -> object | None:
        return stored if getattr(stored, "_exists", False) else None

    def _fake_create(contact: object) -> object:
        stored._exists = True
        stored.email = getattr(contact, "email", stored.email)
        stored.first_name = getattr(contact, "first_name", stored.first_name)
        stored.source = getattr(contact, "source", stored.source)
        stored.source_detail = getattr(contact, "source_detail", stored.source_detail)
        return stored

    monkey_find = MagicMock(side_effect=_fake_find)
    monkey_create = MagicMock(side_effect=_fake_create)
    monkey_update = MagicMock(side_effect=lambda c: c)

    repo.find_by_email = monkey_find  # type: ignore[method-assign]
    repo.create = monkey_create  # type: ignore[method-assign]
    repo.update = monkey_update  # type: ignore[method-assign]

    _, created = repo.upsert_by_email(
        "x@example.com",
        first_name="Pat",
        source=ContactSource.RESERVATION,
        source_detail=first_json,
        contact_type=ContactType.PARENT,
    )
    assert created is True
    contact2, created2 = repo.upsert_by_email(
        "x@example.com",
        first_name="Pat",
        source=ContactSource.RESERVATION,
        source_detail=second_json,
        contact_type=ContactType.PARENT,
    )
    assert created2 is False
    assert contact2.source_detail == first_json
