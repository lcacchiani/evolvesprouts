"""PostgreSQL: unique (purpose_service_id, starts_at) rejects duplicate intro-call slots.

Skipped unless ``TEST_DATABASE_URL`` is set.

Two booking instances share the same intro-call ``services.id`` as ``purpose_service_id``
and the same ``starts_at``; exactly one slot row may exist.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from tests.helpers.db import database_url
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


def _sqlalchemy_engine_url(url: str) -> str:
    if url.startswith("postgresql+") or url.startswith("postgres+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    return url


@pytest.mark.skipif(database_url() is None, reason="TEST_DATABASE_URL not set")
def test_intro_call_purpose_service_slot_unique_starts_at_rejects_duplicate() -> None:
    """Second insert with same ``(purpose_service_id, starts_at)`` raises IntegrityError."""
    url = database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))

    starts = datetime(2036, 6, 15, 1, 0, 0, tzinfo=UTC)
    ends = starts + timedelta(minutes=15)

    with engine.connect() as setup:
        row = setup.execute(
            text(
                "SELECT si.id, si.service_id FROM service_instances si "
                "WHERE si.slug = 'intro-call-free-15min' LIMIT 1"
            )
        ).first()
        if row is None:
            pytest.skip("intro-call-free-15min instance missing in test database")
        _, purpose_svc_id = row[0], row[1]
        setup.execute(
            text(
                "DELETE FROM instance_session_slots WHERE purpose_service_id = :sid "
                "AND starts_at = :st"
            ),
            {"sid": str(purpose_svc_id), "st": starts},
        )
        setup.commit()

    booking_a = None
    booking_b = None
    try:
        with engine.begin() as conn:
            booking_a = conn.execute(
                text(
                    "INSERT INTO service_instances (service_id, slug, created_by, "
                    "status, waitlist_enabled, eventbrite_sync_status, eventbrite_retry_count) "
                    "VALUES (:svc, "
                    "'race-test-booking-a-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', 'open', FALSE, 'skipped', 0) RETURNING id"
                ),
                {"svc": str(purpose_svc_id)},
            ).scalar_one()
            booking_b = conn.execute(
                text(
                    "INSERT INTO service_instances (service_id, slug, created_by, "
                    "status, waitlist_enabled, eventbrite_sync_status, eventbrite_retry_count) "
                    "VALUES (:svc, "
                    "'race-test-booking-b-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', 'open', FALSE, 'skipped', 0) RETURNING id"
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
                    "iid": str(booking_a),
                    "psid": str(purpose_svc_id),
                    "st": starts,
                    "en": ends,
                },
            )

        with pytest.raises(IntegrityError):
            with engine.begin() as conn2:
                conn2.execute(
                    text(
                        "INSERT INTO instance_session_slots "
                        "(instance_id, purpose_service_id, location_id, starts_at, ends_at, "
                        "sort_order) "
                        "VALUES (:iid, :psid, NULL, :st, :en, 0)"
                    ),
                    {
                        "iid": str(booking_b),
                        "psid": str(purpose_svc_id),
                        "st": starts,
                        "en": ends,
                    },
                )
    finally:
        with engine.begin() as cleanup:
            cleanup.execute(
                text(
                    "DELETE FROM instance_session_slots WHERE purpose_service_id = :sid "
                    "AND starts_at = :st"
                ),
                {"sid": str(purpose_svc_id), "st": starts},
            )
            if booking_a is not None:
                cleanup.execute(
                    text("DELETE FROM service_instances WHERE id = :id"),
                    {"id": str(booking_a)},
                )
            if booking_b is not None:
                cleanup.execute(
                    text("DELETE FROM service_instances WHERE id = :id"),
                    {"id": str(booking_b)},
                )


@pytest.mark.skipif(database_url() is None, reason="TEST_DATABASE_URL not set")
def test_intro_call_carrier_slot_blocks_child_booking_at_same_start() -> None:
    """Slot on the intro tier row shares ``purpose_service_id`` with child bookings."""
    url = database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))

    starts = datetime(2036, 6, 16, 1, 0, 0, tzinfo=UTC)
    ends = starts + timedelta(minutes=15)

    with engine.connect() as setup:
        row = setup.execute(
            text(
                "SELECT si.id, si.service_id FROM service_instances si "
                "WHERE si.slug = 'intro-call-free-15min' LIMIT 1"
            )
        ).first()
        if row is None:
            pytest.skip("intro-call-free-15min instance missing in test database")
        tier_row_id, purpose_svc_id = row[0], row[1]
        setup.execute(
            text(
                "DELETE FROM instance_session_slots WHERE purpose_service_id = :sid "
                "AND starts_at = :st"
            ),
            {"sid": str(purpose_svc_id), "st": starts},
        )
        setup.commit()

    booking_child = None
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO instance_session_slots "
                    "(instance_id, purpose_service_id, location_id, starts_at, ends_at, "
                    "sort_order) "
                    "VALUES (:iid, :psid, NULL, :st, :en, 0)"
                ),
                {
                    "iid": str(tier_row_id),
                    "psid": str(purpose_svc_id),
                    "st": starts,
                    "en": ends,
                },
            )

        with engine.begin() as conn:
            booking_child = conn.execute(
                text(
                    "INSERT INTO service_instances (service_id, slug, created_by, "
                    "status, waitlist_enabled, eventbrite_sync_status, eventbrite_retry_count) "
                    "VALUES (:svc, "
                    "'race-test-carrier-vs-child-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', 'open', FALSE, 'skipped', 0) RETURNING id"
                ),
                {"svc": str(purpose_svc_id)},
            ).scalar_one()

        with pytest.raises(IntegrityError):
            with engine.begin() as conn2:
                conn2.execute(
                    text(
                        "INSERT INTO instance_session_slots "
                        "(instance_id, purpose_service_id, location_id, starts_at, ends_at, "
                        "sort_order) "
                        "VALUES (:iid, :psid, NULL, :st, :en, 0)"
                    ),
                    {
                        "iid": str(booking_child),
                        "psid": str(purpose_svc_id),
                        "st": starts,
                        "en": ends,
                    },
                )
    finally:
        with engine.begin() as cleanup:
            cleanup.execute(
                text(
                    "DELETE FROM instance_session_slots WHERE purpose_service_id = :sid "
                    "AND starts_at = :st"
                ),
                {"sid": str(purpose_svc_id), "st": starts},
            )
            if booking_child is not None:
                cleanup.execute(
                    text("DELETE FROM service_instances WHERE id = :id"),
                    {"id": str(booking_child)},
                )
