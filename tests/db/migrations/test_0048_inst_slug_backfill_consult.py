"""PostgreSQL integration: migration ``0048_inst_slug_backfill_consult`` fills NULL instance slugs."""

from __future__ import annotations

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
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _alembic_ini() -> Path:
    return _repo_root() / "backend" / "db" / "alembic.ini"


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
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


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_0048_backfills_null_consultation_instance_slug() -> None:
    url = _database_url()
    assert url is not None
    conn_url = _libpq_conn_url(url)

    cons_svc = UUID("21111111-1111-1111-1111-111111114808")
    cons_inst = UUID("31111111-1111-1111-1111-111111114808")
    slug_pat = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

    _run_alembic("upgrade", "head")
    _run_alembic("downgrade", "0047_orgs_slug_to_partner_key")

    with psycopg.connect(conn_url) as conn:
        conn.execute(
            "DELETE FROM training_instance_details WHERE instance_id = %s",
            (cons_inst,),
        )
        conn.execute("DELETE FROM service_instances WHERE id = %s", (cons_inst,))
        conn.execute("DELETE FROM consultation_details WHERE service_id = %s", (cons_svc,))
        conn.execute("DELETE FROM services WHERE id = %s", (cons_svc,))

        conn.execute(
            """
            INSERT INTO services (
              id, service_type, title, service_key, booking_system, description,
              cover_image_s3_key, delivery_mode, status, created_by,
              service_tier, location_id
            ) VALUES
            (%s, 'consultation', 'Cons 4801', 'cons-4801', NULL, NULL, NULL,
             'online', 'published', 'test', NULL, NULL)
            """,
            (cons_svc,),
        )
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
              id, service_id, title, slug, description, cover_image_s3_key,
              status, delivery_mode, location_id, max_capacity, waitlist_enabled,
              instructor_id, cohort, notes, created_by, created_at,
              eventbrite_event_id, eventbrite_event_url, eventbrite_sync_status
            ) VALUES
            (%s, %s, 'Consult row', NULL, NULL, NULL, NULL, 'scheduled', NULL, NULL,
             NULL, false, NULL, NULL, NULL, 'test', TIMESTAMPTZ '2026-01-01 00:00:00Z',
             NULL, NULL, 'pending')
            """,
            (cons_inst, cons_svc),
        )
        conn.commit()

    _run_alembic("upgrade", "0048_inst_slug_backfill_consult")

    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            "SELECT slug FROM service_instances WHERE id = %s",
            (cons_inst,),
        )
        row = cur.fetchone()
    assert row is not None
    slug = row[0]
    assert slug is not None and str(slug).strip() != ""
    assert slug_pat.match(str(slug)), slug

    _run_alembic("upgrade", "head")
