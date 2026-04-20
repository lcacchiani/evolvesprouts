"""Lambda: download legacy CRM SQL dump from S3 and run the selected entity importer."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any
from typing import Mapping

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.imports import entities  # noqa: F401 — register importers
from app.imports.base import ImportStats
from app.imports.base import parse_skip_legacy_keys_csv
from app.imports.base import resolve_importer_context
from app.imports.registry import get
from app.imports.registry import known_entities
from app.services.aws_clients import get_s3_client
from app.utils.logging import configure_logging
from app.utils.logging import get_logger

configure_logging()
logger = get_logger(__name__)

_ALLOWED_EVENT_KEYS = frozenset(
    {"entity", "s3_bucket", "s3_key", "dry_run", "skip_legacy_keys"},
)


def _env_bucket() -> str:
    return os.environ.get("IMPORT_DUMP_BUCKET_NAME", "").strip()


def _max_bytes() -> int:
    raw = os.environ.get("MAX_IMPORT_DUMP_BYTES", "2097152").strip()
    try:
        return int(raw)
    except ValueError as exc:
        msg = "MAX_IMPORT_DUMP_BYTES must be a non-negative integer"
        raise RuntimeError(msg) from exc


def _validate_event(event: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(event, Mapping):
        msg = "Event must be a JSON object"
        raise ValueError(msg)
    extra = set(event.keys()) - _ALLOWED_EVENT_KEYS
    if extra:
        msg = f"Unknown event keys: {sorted(extra)}"
        raise ValueError(msg)
    entity = event.get("entity")
    bucket = event.get("s3_bucket")
    key = event.get("s3_key")
    dry_run = event.get("dry_run")
    skip_legacy_keys = event.get("skip_legacy_keys")
    if not isinstance(entity, str) or not entity.strip():
        msg = "entity must be a non-empty string"
        raise ValueError(msg)
    entity = entity.strip()
    try:
        get(entity)
    except KeyError as exc:
        known = ", ".join(known_entities()) or "(none)"
        msg = f"Unknown entity {entity!r}; known entities: {known}"
        raise ValueError(msg) from exc
    if not isinstance(bucket, str) or not bucket.strip():
        msg = "s3_bucket must be a non-empty string"
        raise ValueError(msg)
    if not isinstance(key, str) or not key.strip():
        msg = "s3_key must be a non-empty string"
        raise ValueError(msg)
    if not isinstance(dry_run, bool):
        msg = "dry_run must be a boolean"
        raise ValueError(msg)
    if skip_legacy_keys is not None and not isinstance(skip_legacy_keys, str):
        msg = "skip_legacy_keys must be a string or omitted"
        raise ValueError(msg)
    expected = _env_bucket()
    if not expected:
        msg = "IMPORT_DUMP_BUCKET_NAME is not configured"
        raise RuntimeError(msg)
    if bucket != expected:
        msg = "s3_bucket does not match IMPORT_DUMP_BUCKET_NAME"
        raise ValueError(msg)
    return {
        "entity": entity,
        "s3_bucket": bucket,
        "s3_key": key.strip(),
        "dry_run": dry_run,
        "skip_legacy_keys": skip_legacy_keys.strip()
        if isinstance(skip_legacy_keys, str)
        else "",
    }


def _download_dump(bucket: str, key: str, request_id: str) -> str:
    cap = _max_bytes()
    s3 = get_s3_client()
    head = s3.head_object(Bucket=bucket, Key=key)
    size = int(head.get("ContentLength") or 0)
    if size > cap:
        msg = f"S3 object size {size} exceeds MAX_IMPORT_DUMP_BYTES ({cap})"
        raise ValueError(msg)
    safe_rid = "".join(c if c.isalnum() else "_" for c in request_id)[:64] or "req"
    fd, tmp_path = tempfile.mkstemp(
        prefix=f"legacy_crm_{safe_rid}_",
        suffix=".sql",
        dir="/tmp",  # nosec B108
    )
    os.close(fd)
    path = Path(tmp_path)
    try:
        s3.download_file(bucket, key, str(path))
        return path.read_text(encoding="utf-8", errors="replace")
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove temp SQL file at %s", path)


def _stats_to_json(
    stats: ImportStats,
    *,
    preview_allowed: bool,
    include_preview: bool,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "entity": stats.entity,
        "inserted": stats.inserted,
        "skipped_duplicate": stats.skipped_duplicate,
        "skipped_excluded_key": stats.skipped_excluded_key,
        "skipped_no_area": stats.skipped_no_area,
        "skipped_location_no_area": stats.skipped_location_no_area,
        "skipped_no_dep": stats.skipped_no_dep,
        "skipped_household_below_min_links": stats.skipped_household_below_min_links,
        "skipped_deleted": stats.skipped_deleted,
        "reused_existing_contact": stats.reused_existing_contact,
        "dry_run": stats.dry_run,
        "preview_allowed": preview_allowed,
    }
    if include_preview and stats.preview:
        out["preview"] = stats.preview
    if include_preview and stats.row_details:
        out["row_details"] = stats.row_details
    if stats.diagnostics:
        out["diagnostics"] = stats.diagnostics
    return out


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Direct invoke: ``{entity, s3_bucket, s3_key, dry_run[, skip_legacy_keys]}``."""
    payload = _validate_event(event)
    importer = get(payload["entity"])
    req_id = getattr(context, "aws_request_id", None) or "local"
    sql_text = _download_dump(
        payload["s3_bucket"],
        payload["s3_key"],
        str(req_id),
    )
    rows = importer.parse(sql_text)

    skip_keys = parse_skip_legacy_keys_csv(
        payload["skip_legacy_keys"] or None,
    )
    engine = get_engine(use_cache=False)
    with Session(engine) as session:
        ctx = resolve_importer_context(
            importer,
            session,
            dry_run=payload["dry_run"],
            skip_legacy_keys=skip_keys,
            source_sql_text=sql_text,
        )
        stats = importer.apply(session, rows, ctx, dry_run=payload["dry_run"])

    preview_allowed = not importer.PII
    include_preview = preview_allowed or bool(payload["dry_run"])
    out = _stats_to_json(
        stats,
        preview_allowed=preview_allowed,
        include_preview=include_preview,
    )
    log_extra: dict[str, Any] = {}
    if stats.row_details and (preview_allowed or payload["dry_run"]):
        log_extra["import_row_details"] = stats.row_details
    if stats.diagnostics:
        log_extra["import_diagnostics"] = stats.diagnostics
    logger.info(
        "Import complete entity=%s inserted=%s skipped_duplicate=%s "
        "skipped_excluded_key=%s skipped_no_area=%s skipped_location_no_area=%s "
        "skipped_no_dep=%s skipped_household_below_min_links=%s skipped_deleted=%s "
        "reused_existing_contact=%s dry_run=%s",
        stats.entity,
        stats.inserted,
        stats.skipped_duplicate,
        stats.skipped_excluded_key,
        stats.skipped_no_area,
        stats.skipped_location_no_area,
        stats.skipped_no_dep,
        stats.skipped_household_below_min_links,
        stats.skipped_deleted,
        stats.reused_existing_contact,
        stats.dry_run,
        extra=log_extra,
    )
    return out
