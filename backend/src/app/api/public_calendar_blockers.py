"""Public calendar blockers (manual + session-derived half-day blocks)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.services.calendar_blockers import (
    consultation_booking_purpose,
    merge_calendar_blockers_for_purpose,
    resolve_calendar_blockers_wall_timezone,
)
from app.utils import public_cacheable_json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_PURPOSE_PATTERN = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")
_MAX_PURPOSE_LEN = 64
_DEFAULT_RANGE_DAYS = 120


def handle_public_calendar_blockers(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle GET /v1/calendar/blockers and /www/v1/calendar/blockers."""
    if method != "GET":
        logger.info(
            "Calendar blockers method not allowed",
            extra={"method": method},
        )
        return public_cacheable_json_response(
            405, {"error": "Method not allowed"}, event=event
        )

    query = event.get("queryStringParameters") or {}
    purpose_raw = query.get("purpose") if isinstance(query, Mapping) else None
    purpose = str(purpose_raw or "").strip().lower()
    if not purpose:
        return public_cacheable_json_response(
            400, {"error": "purpose query parameter is required"}, event=event
        )
    if len(purpose) > _MAX_PURPOSE_LEN or not _PURPOSE_PATTERN.fullmatch(purpose):
        return public_cacheable_json_response(
            400, {"error": "purpose must be a kebab-case identifier"}, event=event
        )

    from_raw = query.get("from") if isinstance(query, Mapping) else None
    to_raw = query.get("to") if isinstance(query, Mapping) else None
    today = datetime.now(tz=UTC).date()
    start_date = _parse_iso_date(from_raw, default=today)
    end_date = _parse_iso_date(to_raw, default=start_date + timedelta(days=_DEFAULT_RANGE_DAYS))
    if end_date < start_date:
        return public_cacheable_json_response(
            400, {"error": "to must be on or after from"}, event=event
        )
    max_end = start_date + timedelta(days=_DEFAULT_RANGE_DAYS)
    if end_date > max_end:
        end_date = max_end

    logger.info(
        "Handling public calendar blockers",
        extra={
            "purpose": purpose,
            "from": start_date.isoformat(),
            "to": end_date.isoformat(),
        },
    )

    with Session(get_engine()) as session:
        blockers = merge_calendar_blockers_for_purpose(
            session,
            purpose=purpose,
            from_date=start_date,
            to_date=end_date,
        )

    meta: dict[str, Any] = {
        "purpose": purpose,
        "from": start_date.isoformat(),
        "to": end_date.isoformat(),
    }
    if purpose == consultation_booking_purpose():
        meta["wall_time_zone"] = resolve_calendar_blockers_wall_timezone()

    return public_cacheable_json_response(
        200,
        {"blockers": blockers, "meta": meta},
        event=event,
    )


def _parse_iso_date(raw: Any, *, default: date) -> date:
    if raw is None or raw == "":
        return default
    if not isinstance(raw, str):
        return default
    s = raw.strip()
    if len(s) != 10 or s[4] != "-" or s[7] != "-":
        return default
    try:
        y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
        return date(y, m, d)
    except ValueError:
        return default
