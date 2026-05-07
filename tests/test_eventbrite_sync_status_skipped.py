"""PostgreSQL: ``eventbrite_sync_status`` includes ``skipped`` after migrations."""

from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text

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
def test_eventbrite_sync_enum_contains_skipped() -> None:
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM pg_enum e "
                "JOIN pg_type t ON t.oid = e.enumtypid "
                "WHERE t.typname = 'eventbrite_sync_status' AND e.enumlabel = 'skipped')"
            )
        ).scalar_one()
    assert row is True
