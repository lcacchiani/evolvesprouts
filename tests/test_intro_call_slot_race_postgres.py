"""PostgreSQL: unique (template_instance_id, starts_at) rejects duplicate bookings.

Skipped unless ``TEST_DATABASE_URL`` is set.

Two contestants insert session slots on different booking instances but sharing the
same ``template_instance_id`` and ``starts_at``; exactly one row may exist after both attempts.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


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


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_intro_call_template_slot_unique_starts_at_rejects_duplicate() -> None:
    """Second insert with same ``(template_instance_id, starts_at)`` raises IntegrityError."""
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))

    starts = datetime(2036, 6, 15, 1, 0, 0, tzinfo=UTC)
    ends = starts + timedelta(minutes=15)

    with engine.connect() as setup:
        row = setup.execute(
            text(
                "SELECT id FROM service_instances WHERE slug = "
                "'intro-call-free-15min' LIMIT 1"
            )
        ).first()
        if row is None:
            pytest.skip("intro-call-free-15min instance missing in test database")
        template_id = row[0]
        setup.execute(
            text(
                "DELETE FROM instance_session_slots WHERE template_instance_id = :tid "
                "AND starts_at = :st"
            ),
            {"tid": str(template_id), "st": starts},
        )
        setup.commit()

    booking_a = None
    booking_b = None
    try:
        with engine.begin() as conn:
            booking_a = conn.execute(
                text(
                    "INSERT INTO service_instances (service_id, slug, created_by, "
                    "parent_instance_id, is_template, status, waitlist_enabled, "
                    "eventbrite_sync_status) "
                    "SELECT service_id, "
                    "'race-test-booking-a-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', id, FALSE, 'open', FALSE, 'pending' "
                    "FROM service_instances WHERE id = :tid RETURNING id"
                ),
                {"tid": str(template_id)},
            ).scalar_one()
            booking_b = conn.execute(
                text(
                    "INSERT INTO service_instances (service_id, slug, created_by, "
                    "parent_instance_id, is_template, status, waitlist_enabled, "
                    "eventbrite_sync_status) "
                    "SELECT service_id, "
                    "'race-test-booking-b-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', id, FALSE, 'open', FALSE, 'pending' "
                    "FROM service_instances WHERE id = :tid RETURNING id"
                ),
                {"tid": str(template_id)},
            ).scalar_one()
            conn.execute(
                text(
                    "INSERT INTO instance_session_slots "
                    "(instance_id, template_instance_id, location_id, starts_at, ends_at, "
                    "sort_order) "
                    "VALUES (:iid, :tid, NULL, :st, :en, 0)"
                ),
                {
                    "iid": str(booking_a),
                    "tid": str(template_id),
                    "st": starts,
                    "en": ends,
                },
            )

        with pytest.raises(IntegrityError):
            with engine.begin() as conn2:
                conn2.execute(
                    text(
                        "INSERT INTO instance_session_slots "
                        "(instance_id, template_instance_id, location_id, starts_at, ends_at, "
                        "sort_order) "
                        "VALUES (:iid, :tid, NULL, :st, :en, 0)"
                    ),
                    {
                        "iid": str(booking_b),
                        "tid": str(template_id),
                        "st": starts,
                        "en": ends,
                    },
                )
    finally:
        with engine.begin() as cleanup:
            cleanup.execute(
                text(
                    "DELETE FROM instance_session_slots WHERE template_instance_id = :tid "
                    "AND starts_at = :st"
                ),
                {"tid": str(template_id), "st": starts},
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


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_intro_call_template_slot_blocks_child_booking_at_same_start() -> None:
    """Legacy slot on the tier row shares ``template_instance_id`` with child bookings."""
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))

    starts = datetime(2036, 6, 16, 1, 0, 0, tzinfo=UTC)
    ends = starts + timedelta(minutes=15)

    with engine.connect() as setup:
        row = setup.execute(
            text(
                "SELECT id FROM service_instances WHERE slug = "
                "'intro-call-free-15min' LIMIT 1"
            )
        ).first()
        if row is None:
            pytest.skip("intro-call-free-15min instance missing in test database")
        template_id = row[0]
        setup.execute(
            text(
                "DELETE FROM instance_session_slots WHERE template_instance_id = :tid "
                "AND starts_at = :st"
            ),
            {"tid": str(template_id), "st": starts},
        )
        setup.commit()

    booking_child = None
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO instance_session_slots "
                    "(instance_id, template_instance_id, location_id, starts_at, ends_at, "
                    "sort_order) "
                    "VALUES (:iid, :tid, NULL, :st, :en, 0)"
                ),
                {
                    "iid": str(template_id),
                    "tid": str(template_id),
                    "st": starts,
                    "en": ends,
                },
            )

        with engine.begin() as conn:
            booking_child = conn.execute(
                text(
                    "INSERT INTO service_instances (service_id, slug, created_by, "
                    "parent_instance_id, is_template, status, waitlist_enabled, "
                    "eventbrite_sync_status) "
                    "SELECT service_id, "
                    "'race-test-template-vs-child-' || substr(md5(random()::text), 1, 16), "
                    "'pytest', id, FALSE, 'open', FALSE, 'pending' "
                    "FROM service_instances WHERE id = :tid RETURNING id"
                ),
                {"tid": str(template_id)},
            ).scalar_one()

        with pytest.raises(IntegrityError):
            with engine.begin() as conn2:
                conn2.execute(
                    text(
                        "INSERT INTO instance_session_slots "
                        "(instance_id, template_instance_id, location_id, starts_at, ends_at, "
                        "sort_order) "
                        "VALUES (:iid, :tid, NULL, :st, :en, 0)"
                    ),
                    {
                        "iid": str(booking_child),
                        "tid": str(template_id),
                        "st": starts,
                        "en": ends,
                    },
                )
    finally:
        with engine.begin() as cleanup:
            cleanup.execute(
                text(
                    "DELETE FROM instance_session_slots WHERE template_instance_id = :tid "
                    "AND starts_at = :st"
                ),
                {"tid": str(template_id), "st": starts},
            )
            if booking_child is not None:
                cleanup.execute(
                    text("DELETE FROM service_instances WHERE id = :id"),
                    {"id": str(booking_child)},
                )
