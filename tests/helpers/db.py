"""Shared database URL helpers for PostgreSQL integration tests."""

from __future__ import annotations

import os


def database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


def libpq_conn_url(url: str) -> str:
    """Strip SQLAlchemy driver so ``psycopg.connect`` uses a libpq-style URI."""
    return url.replace("postgresql+psycopg://", "postgresql://", 1)
