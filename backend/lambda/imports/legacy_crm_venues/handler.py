"""Lambda: download legacy CRM SQL dump from S3 and import venues into Aurora."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from typing import Mapping

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.imports.legacy_crm_venues import ImportStats
from app.imports.legacy_crm_venues import apply_venues
from app.imports.legacy_crm_venues import parse_legacy_districts
from app.imports.legacy_crm_venues import parse_legacy_venues
from app.services.aws_clients import get_s3_client
from app.utils.logging import configure_logging
from app.utils.logging import get_logger

configure_logging()
logger = get_logger(__name__)

# Lambda provides writable storage only under /tmp; fixed path per invocation is intentional.
TMP_SQL_PATH = Path("/tmp/legacy_crm_venues.sql")  # nosec B108
_ALLOWED_EVENT_KEYS = frozenset({"s3_bucket", "s3_key", "dry_run"})


def _env_bucket() -> str:
    return os.environ.get("IMPORT_DUMP_BUCKET_NAME", "").strip()


def _max_bytes() -> int:
    raw = os.environ.get("MAX_IMPORT_DUMP_BYTES", "2097152").strip()
    return int(raw)


def _validate_event(event: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(event, Mapping):
        msg = "Event must be a JSON object"
        raise ValueError(msg)
    extra = set(event.keys()) - _ALLOWED_EVENT_KEYS
    if extra:
        msg = f"Unknown event keys: {sorted(extra)}"
        raise ValueError(msg)
    bucket = event.get("s3_bucket")
    key = event.get("s3_key")
    dry_run = event.get("dry_run")
    if not isinstance(bucket, str) or not bucket.strip():
        msg = "s3_bucket must be a non-empty string"
        raise ValueError(msg)
    if not isinstance(key, str) or not key.strip():
        msg = "s3_key must be a non-empty string"
        raise ValueError(msg)
    if not isinstance(dry_run, bool):
        msg = "dry_run must be a boolean"
        raise ValueError(msg)
    expected = _env_bucket()
    if not expected:
        msg = "IMPORT_DUMP_BUCKET_NAME is not configured"
        raise RuntimeError(msg)
    if bucket != expected:
        msg = "s3_bucket does not match IMPORT_DUMP_BUCKET_NAME"
        raise ValueError(msg)
    return {"s3_bucket": bucket, "s3_key": key.strip(), "dry_run": dry_run}


def _download_dump(bucket: str, key: str) -> str:
    cap = _max_bytes()
    s3 = get_s3_client()
    head = s3.head_object(Bucket=bucket, Key=key)
    size = int(head.get("ContentLength") or 0)
    if size > cap:
        msg = f"S3 object size {size} exceeds MAX_IMPORT_DUMP_BYTES ({cap})"
        raise ValueError(msg)
    s3.download_file(bucket, key, str(TMP_SQL_PATH))
    return TMP_SQL_PATH.read_text(encoding="utf-8", errors="replace")


def _stats_to_json(stats: ImportStats) -> dict[str, Any]:
    return {
        "inserted": stats.inserted,
        "skipped_duplicate": stats.skipped_duplicate,
        "skipped_no_area": stats.skipped_no_area,
        "dry_run": stats.dry_run,
        "preview": stats.preview,
    }


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Direct invoke only: ``{s3_bucket, s3_key, dry_run}``."""
    payload = _validate_event(event)
    sql_text = _download_dump(payload["s3_bucket"], payload["s3_key"])
    districts = parse_legacy_districts(sql_text)
    venues = parse_legacy_venues(sql_text, districts=districts)

    engine = get_engine(use_cache=False)
    with Session(engine) as session:
        stats = apply_venues(session, venues, dry_run=payload["dry_run"])

    out = _stats_to_json(stats)
    logger.info(
        "Import complete inserted=%s skipped_duplicate=%s skipped_no_area=%s dry_run=%s",
        stats.inserted,
        stats.skipped_duplicate,
        stats.skipped_no_area,
        stats.dry_run,
    )
    return out
