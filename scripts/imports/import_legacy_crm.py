#!/usr/bin/env python3
"""Import rows from a legacy MariaDB/MySQL dump into Aurora (entity-specific).

Usage::

    export DATABASE_URL=postgresql://...
    python scripts/imports/import_legacy_crm.py venues /path/to/backup.sql
    python scripts/imports/import_legacy_crm.py venues /path/to/backup.sql --dry-run

Summary lines use structured logging (typically stderr at INFO).

Environment: ``DATABASE_URL`` (required), ``DATABASE_SSLMODE`` (optional, default ``require``).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_BACKEND_SRC = Path(__file__).resolve().parents[2] / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.imports import entities  # noqa: F401 — register importers
from app.imports.registry import get
from app.imports.registry import known_entities
from app.utils.logging import configure_logging
from app.utils.logging import get_logger

configure_logging()
logger = get_logger(__name__)


def main() -> int:
    choices = known_entities()
    if not choices:
        logger.error("No legacy importers registered.")
        return 1

    parser = argparse.ArgumentParser(
        description="Import legacy CRM rows for a given entity.",
    )
    parser.add_argument(
        "entity",
        choices=choices,
        help="Entity key (registered importers).",
    )
    parser.add_argument(
        "sql_path",
        type=Path,
        help="Path to local MariaDB .sql dump.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and resolve but do not commit writes.",
    )
    args = parser.parse_args()
    path: Path = args.sql_path
    if not path.is_file():
        logger.error("File not found: %s", path)
        return 1

    importer = get(args.entity)
    sql_text = path.read_text(encoding="utf-8", errors="replace")
    rows = importer.parse(sql_text)

    engine = get_engine(use_cache=False)
    with Session(engine) as session:
        ctx = importer.resolve_context(session, dry_run=args.dry_run)
        stats = importer.apply(session, rows, ctx, dry_run=args.dry_run)

    logger.info(
        "Done entity=%s inserted=%s skipped_duplicate=%s skipped_no_area=%s "
        "skipped_no_dep=%s dry_run=%s",
        stats.entity,
        stats.inserted,
        stats.skipped_duplicate,
        stats.skipped_no_area,
        stats.skipped_no_dep,
        stats.dry_run,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
