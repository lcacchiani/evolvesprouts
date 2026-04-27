"""PostgreSQL integration: migration ``0043_backfill_inst_slug`` slug rules."""

from __future__ import annotations

import importlib.util
import os
import re
import subprocess
import sys
from pathlib import Path
from uuid import UUID

import pytest

psycopg = pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


def _database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


def _libpq_conn_url(url: str) -> str:
    """Strip SQLAlchemy driver so ``psycopg.connect`` uses a libpq-style URI."""
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _alembic_ini() -> Path:
    return _repo_root() / "backend" / "db" / "alembic.ini"


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    """CWD must be repo root: ``alembic.ini`` has ``script_location = backend/db/alembic``."""
    env = {**os.environ, "DATABASE_URL": _database_url() or ""}
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


def _load_migration_upgrade_statements() -> list[str]:
    """Load per-statement upgrade SQL from the revision (for SQL-level idempotency checks).

    The revision exposes one constant per top-level statement because psycopg3's
    extended-query protocol only runs the first statement of a multi-statement
    script via ``cursor.execute``. We replay those statements in order.
    """
    path = (
        _repo_root()
        / "backend"
        / "db"
        / "alembic"
        / "versions"
        / "0043_backfill_inst_slug.py"
    )
    spec = importlib.util.spec_from_file_location("revision_0043_inst_slug", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return [
        str(getattr(mod, name))
        for name in (
            "_CREATE_SLUGIFY_FN_SQL",
            "_CREATE_TMP_TABLE_SQL",
            "_INSERT_CANDIDATES_SQL",
            "_RESOLVE_COLLISIONS_SQL",
            "_DROP_SLUGIFY_FN_SQL",
            "_ASSERT_NO_NULL_SLUGS_SQL",
            "_ASSERT_VALID_SLUG_SHAPE_SQL",
        )
    ]


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_0043_backfill_service_instance_slugs() -> None:
    """Backfill MBA, events, collision suffix, empty title fallback, no-slot date; skip consultation."""
    url = _database_url()
    assert url is not None
    conn_url = _libpq_conn_url(url)
    _run_alembic("upgrade", "0042_slug_nulls_nd")

    # One MBA template (same slug+tier as unique index); instances vary tier/cohort via title/cohort.
    mba_svc = UUID("21111111-1111-1111-1111-111111111101")
    mba_i01 = UUID("31111111-1111-1111-1111-111111111101")
    mba_i13 = UUID("31111111-1111-1111-1111-111111111102")
    mba_i36 = UUID("31111111-1111-1111-1111-111111111103")

    evt_svc = UUID("21111111-1111-1111-1111-111111111201")
    evt1 = UUID("31111111-1111-1111-1111-111111111201")
    evt2 = UUID("31111111-1111-1111-1111-111111111202")
    evt3 = UUID("31111111-1111-1111-1111-111111111203")
    evt_empty = UUID("31111111-1111-1111-1111-111111111204")
    evt_noslot = UUID("31111111-1111-1111-1111-111111111205")

    cons_svc = UUID("21111111-1111-1111-1111-111111111301")
    cons_inst = UUID("31111111-1111-1111-1111-111111111301")

    slug_pat = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
    inst_re = re.compile(r"^instance-[a-f0-9]{8}$")

    with psycopg.connect(conn_url) as conn:
        conn.execute(
            "DELETE FROM instance_session_slots WHERE instance_id::text LIKE '31111111%'"
        )
        conn.execute(
            "DELETE FROM event_ticket_tiers WHERE instance_id::text LIKE '31111111%'"
        )
        conn.execute(
            "DELETE FROM training_instance_details WHERE instance_id::text LIKE '31111111%'"
        )
        conn.execute("DELETE FROM service_instances WHERE id::text LIKE '31111111%'")
        conn.execute("DELETE FROM event_details WHERE service_id::text LIKE '21111111%'")
        conn.execute(
            "DELETE FROM training_course_details WHERE service_id::text LIKE '21111111%'"
        )
        conn.execute(
            "DELETE FROM consultation_details WHERE service_id::text LIKE '21111111%'"
        )
        conn.execute("DELETE FROM services WHERE id::text LIKE '21111111%'")

        conn.execute(
            """
            INSERT INTO services (
              id, service_type, title, slug, booking_system, description,
              cover_image_s3_key, delivery_mode, status, created_by,
              service_tier, location_id
            ) VALUES
            (%s, 'training_course', 'MBA', 'my-best-auntie', NULL, NULL, NULL,
             'online', 'published', 'test', NULL, NULL),
            (%s, 'event', 'Event Svc', 'evt-svc-0043', NULL, NULL, NULL,
             'in_person', 'published', 'test', NULL, NULL),
            (%s, 'consultation', 'Cons', NULL, NULL, NULL, NULL,
             'online', 'published', 'test', NULL, NULL)
            """,
            (mba_svc, evt_svc, cons_svc),
        )

        conn.execute(
            """
            INSERT INTO training_course_details (
              service_id, pricing_unit, default_price, default_currency
            ) VALUES (%s, 'per_person', 1.00, 'HKD')
            """,
            (mba_svc,),
        )

        conn.execute(
            """
            INSERT INTO event_details (service_id, event_category, default_price, default_currency)
            VALUES (%s, 'workshop', 10.00, 'HKD')
            """,
            (evt_svc,),
        )

        # `calendly_url` was dropped by migration 0034_drop_calendly_fields; do not include it.
        conn.execute(
            """
            INSERT INTO consultation_details (
              service_id, consultation_format, max_group_size, duration_minutes,
              pricing_model, default_hourly_rate, default_package_price,
              default_package_sessions, default_currency
            ) VALUES (%s, 'one_on_one', NULL, 60, 'free', NULL, NULL, NULL, 'HKD')
            """,
            (cons_svc,),
        )

        conn.execute(
            """
            INSERT INTO service_instances (
              id, service_id, title, slug, landing_page, description, cover_image_s3_key,
              status, delivery_mode, location_id, max_capacity, waitlist_enabled,
              instructor_id, cohort, notes, created_by, created_at,
              eventbrite_event_id, eventbrite_event_url, eventbrite_sync_status
            ) VALUES
            (%s, %s, 'MBA 0-1 Apr 26', NULL, NULL, NULL, NULL, 'scheduled', NULL, NULL,
             NULL, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'MBA 1-3 cohort 04-26', NULL, NULL, NULL, NULL, 'scheduled', NULL, NULL,
             NULL, false, NULL, '04-26', NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'MBA 3-6 May 26', NULL, NULL, NULL, NULL, 'scheduled', NULL, NULL,
             NULL, false, NULL, 'may-26', NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'Easter 2026 Workshop', NULL, NULL, NULL, NULL, 'scheduled', 'in_person', NULL,
             10, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'Easter 2026 Workshop', NULL, NULL, NULL, NULL, 'scheduled', 'in_person', NULL,
             10, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'Easter 2026 Workshop', NULL, NULL, NULL, NULL, 'scheduled', 'in_person', NULL,
             10, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, NULL, NULL, NULL, NULL, NULL, 'scheduled', 'in_person', NULL,
             10, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-05-10 00:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'No Slot Title', NULL, NULL, NULL, NULL, 'scheduled', 'in_person', NULL,
             10, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-03-15 12:00:00Z',
             NULL, NULL, 'pending'),
            (%s, %s, 'Consult', NULL, NULL, NULL, NULL, 'scheduled', NULL, NULL,
             NULL, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending')
            """,
            (
                mba_i01,
                mba_svc,
                mba_i13,
                mba_svc,
                mba_i36,
                mba_svc,
                evt1,
                evt_svc,
                evt2,
                evt_svc,
                evt3,
                evt_svc,
                evt_empty,
                evt_svc,
                evt_noslot,
                evt_svc,
                cons_inst,
                cons_svc,
            ),
        )

        conn.execute(
            """
            INSERT INTO training_instance_details (
              instance_id, training_format, price, currency, pricing_unit
            ) VALUES
            (%s, 'group', 1.00, 'HKD', 'per_person'),
            (%s, 'group', 1.00, 'HKD', 'per_person'),
            (%s, 'group', 1.00, 'HKD', 'per_person')
            """,
            (mba_i01, mba_i13, mba_i36),
        )

        conn.execute(
            """
            INSERT INTO instance_session_slots (
              instance_id, location_id, starts_at, ends_at, sort_order
            ) VALUES
            (%s, NULL, TIMESTAMPTZ '2026-04-06 10:00:00Z', TIMESTAMPTZ '2026-04-06 12:00:00Z', 0),
            (%s, NULL, TIMESTAMPTZ '2026-04-13 10:00:00Z', TIMESTAMPTZ '2026-04-13 12:00:00Z', 0),
            (%s, NULL, TIMESTAMPTZ '2026-04-06 10:00:00Z', TIMESTAMPTZ '2026-04-06 12:00:00Z', 0)
            """,
            (evt1, evt2, evt3),
        )

        for eid in (evt1, evt2, evt3, evt_empty, evt_noslot):
            conn.execute(
                """
                INSERT INTO event_ticket_tiers (
                  instance_id, name, description, price, currency, max_quantity, sort_order
                ) VALUES (%s, 'workshop', NULL, 10.00, 'HKD', NULL, 0)
                """,
                (eid,),
            )

        conn.commit()

    _run_alembic("upgrade", "0043_backfill_inst_slug")

    ids = [
        mba_i01,
        mba_i13,
        mba_i36,
        evt1,
        evt2,
        evt3,
        evt_empty,
        evt_noslot,
        cons_inst,
    ]

    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            "SELECT id, slug FROM service_instances WHERE id = ANY(%s)",
            (ids,),
        )
        by_id = {row[0]: row[1] for row in cur.fetchall()}

    assert by_id[mba_i01] == "my-best-auntie-0-1-apr-26"
    assert by_id[mba_i13] == "my-best-auntie-1-3-04-26"
    assert by_id[mba_i36] == "my-best-auntie-3-6-may-26"
    assert by_id[evt1] == "easter-2026-workshop-2026-04-06"
    assert by_id[evt2] == "easter-2026-workshop-2026-04-13"
    assert by_id[evt3] == "easter-2026-workshop-2026-04-06-2"
    assert inst_re.match(by_id[evt_empty] or "")
    assert by_id[evt_noslot] == "no-slot-title-2026-03-15"
    assert by_id[cons_inst] is None

    for sid, slug in by_id.items():
        if sid == cons_inst:
            continue
        assert slug is not None and slug_pat.match(slug), (sid, slug)

    snapshots = dict(by_id)

    # Re-applying the per-statement upgrade SQL is a no-op when all target rows
    # already have slugs. Note that the temp table from upgrade() is bound to
    # the alembic process's connection and dropped on commit; this test's
    # connection re-creates it via the CREATE TEMP TABLE statement below.
    upgrade_statements = _load_migration_upgrade_statements()
    with psycopg.connect(conn_url) as conn:
        for stmt in upgrade_statements:
            conn.execute(stmt)
        conn.commit()
    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            "SELECT id, slug FROM service_instances WHERE id = ANY(%s)",
            (ids,),
        )
        after_raw = {row[0]: row[1] for row in cur.fetchall()}
    assert after_raw == snapshots

    # Alembic does not re-run an already-applied revision; prove idempotency by
    # clearing slugs, downgrading one step, and upgrading again.
    with psycopg.connect(conn_url) as conn:
        conn.execute(
            "UPDATE service_instances SET slug = NULL WHERE id = ANY(%s)",
            (ids,),
        )
        conn.commit()
    _run_alembic("downgrade", "0042_slug_nulls_nd")
    _run_alembic("upgrade", "0043_backfill_inst_slug")
    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            "SELECT id, slug FROM service_instances WHERE id = ANY(%s)",
            (ids,),
        )
        after_cycle = {row[0]: row[1] for row in cur.fetchall()}
    assert after_cycle == snapshots

    proc_down = _run_alembic("downgrade", "0042_slug_nulls_nd")
    combined = f"{proc_down.stdout}\n{proc_down.stderr}".lower()
    assert proc_down.returncode == 0
    assert "0043_backfill_inst_slug: downgrade is a no-op" in combined
