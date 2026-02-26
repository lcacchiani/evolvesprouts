"""Seeding helpers for migrations Lambda."""

from __future__ import annotations

from pathlib import Path

from .utils import _psycopg_connect


def _run_seed(database_url: str, seed_path: str) -> None:
    """Run seed SQL if the file exists."""
    path = Path(seed_path)
    if not path.exists():
        return

    seed_sql = path.read_text(encoding="utf-8")
    if not seed_sql.strip():
        return

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(seed_sql)
        connection.commit()
