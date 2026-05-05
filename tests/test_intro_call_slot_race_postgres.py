"""PostgreSQL: partial unique index rejects duplicate intro-call ``starts_at``.

Skipped unless ``TEST_DATABASE_URL`` is set.

A full two-session blocking probe is brittle in pytest; we assert the index
exists by observing ``IntegrityError`` on a second insert of the same start time
after the first row is committed.
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
def test_intro_call_instance_unique_starts_at_rejects_duplicate() -> None:
    """Second insert with same ``starts_at`` on intro-call instance raises IntegrityError."""
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))

    starts = datetime(2036, 6, 15, 1, 0, 0, tzinfo=UTC)
    ends = starts + timedelta(minutes=15)

    with engine.connect() as setup:
        row = setup.execute(
            text(
                "SELECT id FROM service_instances WHERE slug = 'intro-call-free-15min' LIMIT 1"
            )
        ).first()
        if row is None:
            pytest.skip("intro-call-free-15min instance missing in test database")
        real_id = row[0]
        setup.execute(
            text(
                "DELETE FROM instance_session_slots WHERE instance_id = :iid AND starts_at = :st"
            ),
            {"iid": str(real_id), "st": starts},
        )
        setup.commit()

    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT id FROM service_instances WHERE slug = "
                    "'intro-call-free-15min' LIMIT 1"
                )
            ).first()
            assert row is not None
            iid = row[0]
            conn.execute(
                text(
                    "INSERT INTO instance_session_slots "
                    "(instance_id, location_id, starts_at, ends_at, sort_order) "
                    "VALUES (:iid, NULL, :st, :en, 0)"
                ),
                {"iid": str(iid), "st": starts, "en": ends},
            )

        with pytest.raises(IntegrityError):
            with engine.begin() as conn2:
                row2 = conn2.execute(
                    text(
                        "SELECT id FROM service_instances WHERE slug = "
                        "'intro-call-free-15min' LIMIT 1"
                    )
                ).first()
                assert row2 is not None
                conn2.execute(
                    text(
                        "INSERT INTO instance_session_slots "
                        "(instance_id, location_id, starts_at, ends_at, sort_order) "
                        "VALUES (:iid, NULL, :st, :en, 0)"
                    ),
                    {"iid": str(row2[0]), "st": starts, "en": ends},
                )
    finally:
        with engine.connect() as cleanup:
            row = cleanup.execute(
                text(
                    "SELECT id FROM service_instances WHERE slug = "
                    "'intro-call-free-15min' LIMIT 1"
                )
            ).first()
            if row is not None:
                cleanup.execute(
                    text(
                        "DELETE FROM instance_session_slots WHERE instance_id = :iid "
                        "AND starts_at = :st"
                    ),
                    {"iid": str(row[0]), "st": starts},
                )
                cleanup.commit()
