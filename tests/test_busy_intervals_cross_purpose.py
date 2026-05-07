"""Cross-purpose calendar collision integration (PostgreSQL when ``TEST_DATABASE_URL`` is set).

Seeds minimal rows; removes them in ``finally``. Skips when URL or intro-call template is missing.
"""

from __future__ import annotations

import os
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.calendar_blockers import compute_available_consultation_slots
from app.services.intro_call_slots import compute_available_intro_call_slots

pytest.importorskip("psycopg", reason="psycopg required for DB integration test")

_MONDAY = date(2030, 6, 10)
assert _MONDAY.weekday() == 0
_NOW = datetime(2030, 6, 1, 12, 0, 0, tzinfo=UTC)
_INTRO_START_UTC = datetime(2030, 6, 10, 1, 15, 0, tzinfo=UTC)
_INTRO_END_UTC = _INTRO_START_UTC + timedelta(minutes=15)
_AM_START_UTC = datetime(2030, 6, 10, 1, 0, 0, tzinfo=UTC)
_AM_END_UTC = datetime(2030, 6, 10, 4, 0, 0, tzinfo=UTC)


def _database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


def _sqlalchemy_engine_url(url: str) -> str:
    if url.startswith("postgresql+") or url.startswith("postgres+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    return url


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_intro_call_slot_blocks_consultation_am() -> None:
    """Intro-call booking overlap removes Monday AM half-day from consultation availability."""
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))
    SessionLocal = sessionmaker(bind=engine)
    intro_child_id = None
    with engine.connect() as setup:
        row = setup.execute(
            text(
                "SELECT si.id, si.service_id FROM service_instances si "
                "WHERE lower(si.slug) = 'intro-call-free-15min' LIMIT 1"
            )
        ).first()
        if row is None:
            pytest.skip("intro-call-free-15min instance missing in test database")
        _carrier_id, purpose_svc_id = row[0], row[1]
        setup.execute(
            text(
                "DELETE FROM instance_session_slots WHERE instance_id IN ("
                "SELECT id FROM service_instances WHERE slug LIKE 'cross-purpose-test-intro-%'"
                ")"
            )
        )
        setup.execute(
            text(
                "DELETE FROM service_instances WHERE slug LIKE 'cross-purpose-test-intro-%'"
            )
        )
        setup.commit()

    try:
        with engine.begin() as conn:
            intro_child_id = conn.execute(
                text(
                    "INSERT INTO service_instances ("
                    "service_id, slug, created_by, "
                    "status, waitlist_enabled, delivery_mode, eventbrite_sync_status, "
                    "eventbrite_retry_count"
                    ") "
                    "VALUES (:svc, "
                    "'cross-purpose-test-intro-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', 'open', FALSE, 'online', 'skipped', 0) RETURNING id"
                ),
                {"svc": str(purpose_svc_id)},
            ).scalar_one()
            conn.execute(
                text(
                    "INSERT INTO instance_session_slots "
                    "(instance_id, purpose_service_id, location_id, starts_at, ends_at, "
                    "sort_order) "
                    "VALUES (:iid, :psid, NULL, :st, :en, 0)"
                ),
                {
                    "iid": str(intro_child_id),
                    "psid": str(purpose_svc_id),
                    "st": _INTRO_START_UTC,
                    "en": _INTRO_END_UTC,
                },
            )

        with SessionLocal() as session:
            slots = compute_available_consultation_slots(
                session,
                from_date=_MONDAY,
                to_date=_MONDAY,
                now=_NOW,
            )
        am_starts = {_utc(s[0]).replace(microsecond=0) for s in slots}
        assert _AM_START_UTC.replace(microsecond=0) not in am_starts
    finally:
        if intro_child_id is not None:
            with engine.begin() as conn:
                conn.execute(
                    text("DELETE FROM service_instances WHERE id = :id"),
                    {"id": str(intro_child_id)},
                )


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_consultation_booking_blocks_intro_slot() -> None:
    """Consultation session overlap removes intro-call candidates inside Monday AM UTC window."""
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))
    SessionLocal = sessionmaker(bind=engine)

    booking_id = None
    created_service_id = None

    try:
        with engine.begin() as conn:
            svc_row = conn.execute(
                text(
                    "SELECT id FROM services WHERE service_type = 'consultation' "
                    "AND status = 'published' LIMIT 1"
                )
            ).first()
            if svc_row is None:
                created_service_id = conn.execute(
                    text(
                        "INSERT INTO services ("
                        "service_type, title, service_key, booking_system, description, "
                        "cover_image_s3_key, delivery_mode, status, created_by, "
                        "service_tier, location_id"
                        ") VALUES ("
                        "'consultation', "
                        "'pytest cross-purpose consultation', "
                        "'pytest-cpt-' || substr(md5(random()::text), 1, 16), "
                        "'consultation-booking', "
                        "NULL, NULL, 'online', 'published', 'pytest', NULL, NULL"
                        ") RETURNING id"
                    )
                ).scalar_one()
                service_id = created_service_id
                conn.execute(
                    text(
                        "INSERT INTO consultation_details ("
                        "service_id, consultation_format, max_group_size, duration_minutes, "
                        "pricing_model, default_hourly_rate, default_package_price, "
                        "default_package_sessions, default_currency"
                        ") VALUES ("
                        ":sid, 'one_on_one', NULL, 60, 'hourly', 100.00, NULL, NULL, 'HKD'"
                        ")"
                    ),
                    {"sid": str(service_id)},
                )
            else:
                service_id = svc_row[0]

            slug_prefix = f"cross-purpose-cpt-{uuid4().hex[:12]}"
            booking_id = conn.execute(
                text(
                    "INSERT INTO service_instances ("
                    "service_id, slug, created_by, "
                    "status, waitlist_enabled, delivery_mode, eventbrite_sync_status, "
                    "eventbrite_retry_count"
                    ") VALUES ("
                    ":sid, :slug, 'pytest', 'open', FALSE, 'online', 'skipped', 0"
                    ") RETURNING id"
                ),
                {"sid": str(service_id), "slug": f"{slug_prefix}-book"},
            ).scalar_one()

            conn.execute(
                text(
                    "INSERT INTO instance_session_slots "
                    "(instance_id, purpose_service_id, location_id, starts_at, ends_at, "
                    "sort_order) "
                    "VALUES (:iid, :psid, NULL, :st, :en, 0)"
                ),
                {
                    "iid": str(booking_id),
                    "psid": str(service_id),
                    "st": _AM_START_UTC,
                    "en": _AM_END_UTC,
                },
            )

        with SessionLocal() as session:
            slots = compute_available_intro_call_slots(
                session,
                from_date=_MONDAY,
                to_date=_MONDAY,
                now=_NOW,
            )

        block_lo = _AM_START_UTC
        block_hi = _AM_END_UTC
        assert not any(block_lo <= _utc(s0) < block_hi for s0, _ in slots)
    finally:
        with engine.begin() as conn:
            if booking_id is not None:
                conn.execute(
                    text("DELETE FROM service_instances WHERE id = :id"),
                    {"id": str(booking_id)},
                )
            if created_service_id is not None:
                conn.execute(
                    text("DELETE FROM services WHERE id = :id"),
                    {"id": str(created_service_id)},
                )
