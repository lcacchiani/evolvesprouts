"""Cross-purpose busy_intervals_utc smoke integration (optional Postgres, M2).

When ``TEST_DATABASE_URL`` is set, exercises the real SQL paths inside
``busy_intervals_utc`` (no monkeypatch). Extend with deterministic seed rows when a
stable isolated fixture database is available.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.services.public_calendar_availability import busy_intervals_utc

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
def test_busy_intervals_utc_runs_against_live_database() -> None:
    """Smoke: merged busy intervals list when Aurora (or compatible Postgres) is reachable."""
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))
    start = datetime(2035, 6, 4, 0, 0, tzinfo=UTC)
    end = datetime(2035, 6, 5, 23, 59, tzinfo=UTC)
    with Session(engine) as session:
        merged = busy_intervals_utc(
            session,
            range_start_utc=start,
            range_end_utc=end,
        )
    assert isinstance(merged, list)
