"""PostgreSQL semantics for services slug+tier unique index (NULLS NOT DISTINCT).

Skipped unless ``TEST_DATABASE_URL`` is set (e.g. local Postgres for integration).
Validates the DDL pattern used in migration ``0042_slug_nulls_nd``.
"""

from __future__ import annotations

import os

import pytest

psycopg = pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


def _database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


def _libpq_conn_url(url: str) -> str:
    """Strip SQLAlchemy driver so ``psycopg.connect`` uses a libpq-style URI."""
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_slug_tier_unique_index_treats_null_tier_as_single_bucket() -> None:
    """Two rows with same slug and NULL tier must violate NULLS NOT DISTINCT unique index."""
    ddl = (
        "CREATE TEMP TABLE slug_tier_uq_probe ("
        "slug varchar(80), service_tier varchar(128)"
        ") ON COMMIT DROP"
    )
    idx = (
        "CREATE UNIQUE INDEX slug_tier_uq_probe_idx "
        "ON slug_tier_uq_probe (lower(slug), lower(service_tier)) "
        "NULLS NOT DISTINCT WHERE slug IS NOT NULL"
    )
    url = _database_url()
    assert url is not None
    conn_url = _libpq_conn_url(url)

    with psycopg.connect(conn_url) as conn:
        conn.execute(ddl)
        conn.execute(idx)
        conn.execute(
            "INSERT INTO slug_tier_uq_probe (slug, service_tier) VALUES ('same-slug', NULL)"
        )
        with pytest.raises(psycopg.errors.UniqueViolation):
            conn.execute(
                "INSERT INTO slug_tier_uq_probe (slug, service_tier) VALUES ('same-slug', NULL)"
            )
        conn.rollback()

    with psycopg.connect(conn_url) as conn:
        conn.execute(ddl)
        conn.execute(idx)
        conn.execute(
            "INSERT INTO slug_tier_uq_probe (slug, service_tier) VALUES ('x', NULL)"
        )
        conn.execute(
            "INSERT INTO slug_tier_uq_probe (slug, service_tier) VALUES ('x', 'tier-a')"
        )
        conn.execute(
            "INSERT INTO slug_tier_uq_probe (slug, service_tier) VALUES ('x', 'tier-b')"
        )
        conn.commit()
