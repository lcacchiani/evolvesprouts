"""Admin API for purpose-scoped manual calendar blocks."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_request import parse_body, parse_uuid, query_param
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.engine import get_engine
from app.db.repositories.calendar_manual_block import CalendarManualBlockRepository
from app.exceptions import NotFoundError, ValidationError
from app.services.calendar_blockers import consultation_booking_purpose
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_PURPOSE_PATTERN = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")
_MAX_PURPOSE_LEN = 64
_MAX_NOTE = 500


def handle_admin_calendar_manual_blocks_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/calendar/manual-blocks routes."""
    logger.info(
        "Handling admin calendar manual blocks",
        extra={"method": method, "path": path},
    )
    parts = split_route_parts(path)
    if len(parts) < 3 or parts[0] != "admin" or parts[1] != "calendar":
        return json_response(404, {"error": "Not found"}, event=event)
    if parts[2] != "manual-blocks":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 3:
        if method == "GET":
            return _list_blocks(event)
        if method == "POST":
            return _create_block(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    block_id = parse_uuid(parts[3])
    if len(parts) == 4:
        if method == "GET":
            return _get_block(event, block_id=block_id)
        if method == "PATCH":
            return _update_block(event, block_id=block_id, actor_sub=identity.user_sub)
        if method == "DELETE":
            return _delete_block(event, block_id=block_id)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _parse_purpose(raw: Any) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("purpose is required", field="purpose")
    s = raw.strip().lower()
    if len(s) > _MAX_PURPOSE_LEN or not _PURPOSE_PATTERN.fullmatch(s):
        raise ValidationError("purpose must be a valid identifier", field="purpose")
    return s


def _parse_block_date(raw: Any) -> date:
    if not isinstance(raw, str) or len(raw.strip()) != 10:
        raise ValidationError("blockDate must be YYYY-MM-DD", field="blockDate")
    s = raw.strip()
    try:
        y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
        return date(y, m, d)
    except ValueError as exc:
        raise ValidationError("blockDate is invalid", field="blockDate") from exc


def _parse_period(raw: Any) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("period is required", field="period")
    p = raw.strip().lower()
    if p not in ("am", "pm", "both"):
        raise ValidationError("period must be am, pm, or both", field="period")
    return p


def _optional_note(raw: Any) -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ValidationError("note must be a string", field="note")
    s = raw.strip()
    if len(s) > _MAX_NOTE:
        raise ValidationError("note is too long", field="note")
    return s or None


def _serialize_block(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "purpose": row.purpose,
        "block_date": row.block_date.isoformat(),
        "period": row.period,
        "note": row.note,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _list_blocks(event: Mapping[str, Any]) -> dict[str, Any]:
    purpose = _parse_purpose(query_param(event, "purpose"))
    from_s = query_param(event, "from")
    to_s = query_param(event, "to")
    if not from_s or not to_s:
        raise ValidationError("from and to query parameters are required", field="from")
    start = _parse_block_date(from_s)
    end = _parse_block_date(to_s)
    if end < start:
        raise ValidationError("to must be on or after from", field="to")

    with Session(get_engine()) as session:
        repo = CalendarManualBlockRepository(session)
        rows = repo.list_for_purpose_between(purpose=purpose, start_date=start, end_date=end)
        items = [_serialize_block(r) for r in rows]
        session.commit()

    return json_response(200, {"items": items}, event=event)


def _get_block(event: Mapping[str, Any], *, block_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repo = CalendarManualBlockRepository(session)
        row = repo.get_by_id(block_id)
        if row is None:
            raise NotFoundError("Block not found")
        payload = _serialize_block(row)
        session.commit()
    return json_response(200, {"block": payload}, event=event)


def _create_block(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    _ = actor_sub
    body = parse_body(event)
    purpose = _parse_purpose(body.get("purpose"))
    if purpose != consultation_booking_purpose():
        raise ValidationError(
            "Only consultation_booking purpose is supported in this release",
            field="purpose",
        )
    block_date = _parse_block_date(body.get("blockDate") or body.get("block_date"))
    period = _parse_period(body.get("period"))
    note = _optional_note(body.get("note"))

    with Session(get_engine()) as session:
        repo = CalendarManualBlockRepository(session)
        try:
            row = repo.create(purpose=purpose, block_date=block_date, period=period, note=note)
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "A block for this purpose, date, and period already exists",
                field="period",
            ) from exc
        payload = _serialize_block(row)
        session.commit()

    return json_response(201, {"block": payload}, event=event)


def _update_block(
    event: Mapping[str, Any],
    *,
    block_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    _ = actor_sub
    body = parse_body(event)
    block_date = _parse_block_date(body.get("blockDate") or body.get("block_date"))
    period = _parse_period(body.get("period"))
    note = _optional_note(body.get("note"))

    with Session(get_engine()) as session:
        repo = CalendarManualBlockRepository(session)
        row = repo.get_by_id(block_id)
        if row is None:
            session.rollback()
            raise NotFoundError("Block not found")
        if row.purpose != consultation_booking_purpose():
            session.rollback()
            raise ValidationError("Block purpose cannot be changed", field="purpose")
        row.block_date = block_date
        row.period = period
        row.note = note
        try:
            session.flush()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "A block for this purpose, date, and period already exists",
                field="period",
            ) from exc
        session.refresh(row)
        payload = _serialize_block(row)
        session.commit()

    return json_response(200, {"block": payload}, event=event)


def _delete_block(event: Mapping[str, Any], *, block_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repo = CalendarManualBlockRepository(session)
        deleted = repo.delete_by_id(block_id)
        if not deleted:
            session.rollback()
            raise NotFoundError("Block not found")
        session.commit()
    return json_response(200, {"deleted": True}, event=event)
