"""PostgreSQL integration: migration ``0046_services_slug_to_key`` renames services.slug."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

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
def test_0046_renames_services_slug_column_and_index() -> None:
    """At 0046 head: services.service_key exists and the composite index was renamed."""
    url = database_url()
    assert url is not None
    conn_url = libpq_conn_url(url)

    _run_alembic("upgrade", "head")
    _run_alembic("downgrade", "0045_enroll_inst_contact_uidx")

    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'services'
              AND column_name IN ('slug', 'service_key')
            """
        )
        cols = {row[0] for row in cur.fetchall()}
        assert "slug" in cols
        assert "service_key" not in cols

    _run_alembic("upgrade", "0046_services_slug_to_key")

    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'services'
              AND column_name IN ('slug', 'service_key')
            """
        )
        cols = {row[0] for row in cur.fetchall()}
        assert "service_key" in cols
        assert "slug" not in cols

        cur2 = conn.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'services'
              AND indexname = 'services_service_key_tier_unique_idx'
            """
        )
        assert cur2.fetchone() is not None

    _run_alembic("upgrade", "head")
