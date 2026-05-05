"""Public GET /v1/calendar/intro-call-slots (15-minute availability, no PII).

GET responses for routes reachable via the public website CloudFront ``/www/*``
proxy must include a ``Cache-Control`` header: use a shared-cache friendly value
on success (200) and ``no-store`` on errors so CloudFront never retains unsafe
responses.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.services.intro_call_slots import (
    compute_available_intro_call_slots,
    resolve_intro_call_wall_timezone,
)
from app.utils import public_cacheable_json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MAX_SPAN_DAYS = 28
_MAX_FORWARD_DAYS = 35


def _parse_iso_date(raw: Any, *, default: date) -> date | None:
    if raw is None or str(raw).strip() == "":
        return default
    s = str(raw).strip()
    if not _DATE_PATTERN.fullmatch(s):
        return None
    try:
        y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
        return date(y, m, d)
    except ValueError:
        return None


def handle_public_calendar_intro_call_slots(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Return available intro-call slots as UTC ISO instants."""
    if method != "GET":
        return public_cacheable_json_response(
            405, {"error": "Method not allowed"}, event=event
        )

    query = event.get("queryStringParameters") or {}
    if not isinstance(query, Mapping):
        query = {}

    wall_zone = ZoneInfo(resolve_intro_call_wall_timezone())
    today = datetime.now(tz=wall_zone).date()

    from_raw = query.get("from")
    to_raw = query.get("to")
    from_date = _parse_iso_date(from_raw, default=today)
    if from_date is None:
        return public_cacheable_json_response(
            400, {"error": "Invalid from date"}, event=event
        )

    default_to = from_date + timedelta(days=21)
    to_date = _parse_iso_date(to_raw, default=default_to)
    if to_date is None:
        return public_cacheable_json_response(
            400, {"error": "Invalid to date"}, event=event
        )

    if to_date < from_date:
        return public_cacheable_json_response(
            400, {"error": "to must be on or after from"}, event=event
        )

    span = (to_date - from_date).days
    if span > _MAX_SPAN_DAYS:
        return public_cacheable_json_response(
            400,
            {"error": f"Date range exceeds maximum of {_MAX_SPAN_DAYS} days"},
            event=event,
        )

    if (from_date - today).days > _MAX_FORWARD_DAYS:
        return public_cacheable_json_response(
            400,
            {"error": "from is too far in the future"},
            event=event,
        )

    now = datetime.now(tz=UTC)
    with Session(get_engine()) as session:
        slots = compute_available_intro_call_slots(
            session, from_date=from_date, to_date=to_date, now=now
        )

    body = {
        "slots": [
            {
                "start_iso": s0.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end_iso": s1.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            for s0, s1 in slots
        ]
    }
    return public_cacheable_json_response(200, body, event=event)
