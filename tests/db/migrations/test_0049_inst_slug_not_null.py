"""PostgreSQL integration: migration ``0049_inst_slug_not_null`` sets slug NOT NULL."""

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
def test_0049_service_instances_slug_is_not_null() -> None:
    _run_alembic("upgrade", "head")

    url = database_url()
    assert url is not None
    conn_url = libpq_conn_url(url)

    with psycopg.connect(conn_url) as conn:
        cur = conn.execute(
            """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'service_instances'
              AND column_name = 'slug'
            """
        )
        row = cur.fetchone()
    assert row is not None
    assert row[0] == "NO"
