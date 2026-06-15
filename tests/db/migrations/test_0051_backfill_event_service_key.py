"""PostgreSQL integration: migration ``0051_backfill_event_service_key``."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from uuid import UUID

import pytest

from tests.helpers.db import database_url, libpq_conn_url

psycopg = pytest.importorskip(
    "psycopg", reason="psycopg required for DB integration test"
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _alembic_ini() -> Path:
    return _repo_root() / "backend" / "db" / "alembic.ini"


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "DATABASE_URL": database_url() or ""}
    cmd = [sys.executable, "-m", "alembic", "-c", str(_alembic_ini()), *args]
    proc = subprocess.run(
        cmd,
        cwd=str(_repo_root()),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(
            f"alembic {' '.join(args)} failed:\n{proc.stdout}\n{proc.stderr}"
        )
    return proc


@pytest.mark.skipif(database_url() is None, reason="TEST_DATABASE_URL not set")
def test_0051_backfills_service_key_for_events_and_training() -> None:
    url = database_url()
    assert url is not None
    conn_url = libpq_conn_url(url)

    svc_empty_title = UUID("f1111111-1111-1111-1111-111111115051")
    svc_event_titled = UUID("f1111111-1111-1111-1111-111111115052")
    svc_preexisting = UUID("f1111111-1111-1111-1111-211111115053")
    svc_collision_new = UUID("f1111111-1111-1111-1111-211111115054")

    key_pat = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

    _run_alembic("upgrade", "head")
    _run_alembic("downgrade", "0050_fix_mba_service_key")

    with psycopg.connect(conn_url) as conn:
        conn.execute(
            "DELETE FROM event_details WHERE service_id::text LIKE 'f1111111%'"
        )
        conn.execute(
            "DELETE FROM training_course_details WHERE service_id::text LIKE 'f1111111%'"
        )
        conn.execute("DELETE FROM services WHERE id::text LIKE 'f1111111%'")

        conn.execute(
            """
            INSERT INTO services (
              id, service_type, title, service_key, booking_system, description,
              cover_image_s3_key, delivery_mode, status, created_by,
              service_tier, location_id
            ) VALUES
            (%s, 'event', '', NULL, NULL, NULL, NULL,
             'in_person', 'published', 'test', NULL, NULL),
            (%s, 'event', 'Spring Workshop', NULL, NULL, NULL, NULL,
             'in_person', 'published', 'test', NULL, NULL),
            (%s, 'training_course', 'Preexisting', 'collision-course', NULL, NULL, NULL,
             'online', 'published', 'test', NULL, NULL),
            (%s, 'training_course', 'Collision Course', NULL, NULL, NULL, NULL,
             'online', 'published', 'test', NULL, NULL)
            """,
            (svc_empty_title, svc_event_titled, svc_preexisting, svc_collision_new),
        )

        conn.execute(
            """
            INSERT INTO event_details (service_id, event_category, default_price, default_currency)
            VALUES (%s, 'workshop', 10.00, 'HKD'),
                   (%s, 'workshop', 10.00, 'HKD')
            """,
            (svc_empty_title, svc_event_titled),
        )

        conn.execute(
            """
            INSERT INTO training_course_details (
              service_id, pricing_unit, default_price, default_currency
            ) VALUES (%s, 'per_person', 1.00, 'HKD'),
                      (%s, 'per_person', 1.00, 'HKD')
            """,
            (svc_preexisting, svc_collision_new),
        )

        conn.commit()

    _run_alembic("upgrade", "0051_backfill_event_service_key")

    with psycopg.connect(conn_url) as conn:
        rows = conn.execute(
            "SELECT id, service_key FROM services WHERE id = ANY(%s)",
            (
                [
                    svc_empty_title,
                    svc_event_titled,
                    svc_preexisting,
                    svc_collision_new,
                ],
            ),
        ).fetchall()

    by_id = {r[0]: r[1] for r in rows}

    empty_key = by_id[svc_empty_title]
    assert empty_key is not None and str(empty_key).strip() != ""
    assert key_pat.match(str(empty_key)), empty_key
    assert str(empty_key).startswith("event-")

    assert by_id[svc_event_titled] == "spring-workshop"
    assert by_id[svc_preexisting] == "collision-course"
    assert by_id[svc_collision_new] == "collision-course-2"

    _run_alembic("upgrade", "head")
