#!/usr/bin/env python3
"""Import venues from a legacy MariaDB/MySQL dump into PostgreSQL ``locations``.

Reads a **local path** to a ``.sql`` dump (for example downloaded from S3 to
``/tmp``). The dump is **not** committed to git; keep it outside the repo or
under ``scripts/imports/`` (gitignored).

Expected legacy tables (Evolve Sprouts CRM):

- ``district`` — ``id``, ``name`` (Hong Kong district label), …
- ``venue`` — ``name``, ``address_line1``, ``address_line2``, ``district_id``

Each imported row becomes a ``locations`` row with ``area_id`` resolved by
matching ``district.name`` to ``geographic_areas`` (child of country ``HK``,
``level = 'district'``).

Usage::

    export DATABASE_URL=postgresql://...
    python scripts/imports/import_legacy_crm_venues.py /path/to/backup.sql

    # Preview without writing
    python scripts/imports/import_legacy_crm_venues.py /path/to/backup.sql --dry-run

Summary lines are emitted via structured logging (default: **stderr** at INFO). Set
``LOG_LEVEL`` / handler configuration if you need them on stdout.

Environment:

- ``DATABASE_URL`` — required (same as Alembic / app).
- ``DATABASE_SSLMODE`` — optional, default ``require``.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Repo layout: scripts/imports/ -> backend/src
_BACKEND_SRC = Path(__file__).resolve().parents[2] / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.imports.legacy_crm_venues import apply_venues
from app.imports.legacy_crm_venues import parse_legacy_districts
from app.imports.legacy_crm_venues import parse_legacy_venues
from app.utils.logging import configure_logging
from app.utils.logging import get_logger

configure_logging()
logger = get_logger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import legacy CRM venue rows into locations.",
    )
    parser.add_argument(
        "sql_path",
        type=Path,
        help="Path to local MariaDB .sql dump (not committed to git).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and resolve areas but do not insert rows.",
    )
    args = parser.parse_args()
    path: Path = args.sql_path
    if not path.is_file():
        logger.error("File not found: %s", path)
        return 1

    sql_text = path.read_text(encoding="utf-8", errors="replace")
    districts = parse_legacy_districts(sql_text)
    venues = parse_legacy_venues(sql_text, districts=districts)

    engine = get_engine(use_cache=False)
    with Session(engine) as session:
        stats = apply_venues(
            session,
            venues,
            dry_run=args.dry_run,
            district_map=districts,
        )

    logger.info(
        "Done. inserted=%s skipped_duplicate=%s skipped_no_area=%s dry_run=%s",
        stats.inserted,
        stats.skipped_duplicate,
        stats.skipped_no_area,
        stats.dry_run,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
