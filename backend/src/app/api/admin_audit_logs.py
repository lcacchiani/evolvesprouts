"""Admin audit log read API (database change history)."""

from __future__ import annotations

from typing import Any
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.api.admin_request import (
    encode_cursor,
    parse_cursor,
    parse_limit,
    parse_uuid,
    query_param,
    request_id,
)
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import AuditLogRepository, set_audit_context
from app.db.engine import get_engine
from app.db.models import AuditLog
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response, parse_datetime
from app.utils.logging import get_logger

logger = get_logger(__name__)

AUDIT_REDACTED_FIELDS: frozenset[str] = frozenset(
    ("password", "secret", "token", "api_key")
)

AUDITABLE_TABLES: frozenset[str] = frozenset(
    ("assets", "asset_access_grants", "calendar_manual_blocks")
)

_DEFAULT_LIMIT = 50
_MAX_LIMIT = 100


def handle_admin_audit_logs_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle ``/v1/admin/audit-logs`` and ``/v1/admin/audit-logs/{id}``."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "audit-logs":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method != "GET":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _list_audit_logs(event, actor_sub=identity.user_sub)

    if len(parts) == 3:
        if method != "GET":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _get_audit_log_by_id(
            event, audit_id=parts[2], actor_sub=identity.user_sub
        )

    return json_response(404, {"error": "Not found"}, event=event)


def _get_audit_log_by_id(
    event: Mapping[str, Any],
    *,
    audit_id: str,
    actor_sub: str,
) -> dict[str, Any]:
    parsed_id = parse_uuid(audit_id)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repo = AuditLogRepository(session)
        entry = repo.get_by_id(parsed_id)
        if entry is None:
            raise NotFoundError("audit_log", audit_id)
        return json_response(200, _serialize_audit_log(entry), event=event)


def _list_audit_logs(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    limit = parse_limit(event, default=_DEFAULT_LIMIT, max_limit=_MAX_LIMIT)

    table_name = query_param(event, "table")
    record_id = query_param(event, "record_id")
    user_id = query_param(event, "user_id")
    action = query_param(event, "action")
    since_str = query_param(event, "since")

    if table_name and table_name not in AUDITABLE_TABLES:
        raise ValidationError(
            (
                f"Invalid table: {table_name}. Must be one of: "
                f"{', '.join(sorted(AUDITABLE_TABLES))}"
            ),
            field="table",
        )

    if record_id and not table_name:
        raise ValidationError(
            "table parameter is required when filtering by record_id",
            field="table",
        )

    valid_actions = {"INSERT", "UPDATE", "DELETE"}
    if action and action.upper() not in valid_actions:
        raise ValidationError(
            f"Invalid action: {action}. Must be one of: INSERT, UPDATE, DELETE",
            field="action",
        )

    since = None
    if since_str:
        since = parse_datetime(since_str)
        if since is None:
            raise ValidationError(
                "Invalid since format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)",
                field="since",
            )

    if user_id == "__no_match__":
        return json_response(
            200,
            {"items": [], "next_cursor": None},
            event=event,
        )

    cursor = parse_cursor(query_param(event, "cursor"))

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repo = AuditLogRepository(session)

        if record_id and table_name:
            rows = repo.get_record_history(
                table_name=table_name,
                record_id=record_id,
                limit=limit + 1,
            )
        elif user_id:
            rows = repo.get_user_activity(
                user_id=user_id,
                limit=limit + 1,
                since=since,
            )
        elif table_name:
            rows = repo.get_table_activity(
                table_name=table_name,
                limit=limit + 1,
                since=since,
                action=action.upper() if action else None,
            )
        else:
            rows = repo.get_recent_activity(
                limit=limit + 1,
                since=since,
                cursor=cursor,
            )

    has_more = len(rows) > limit
    trimmed = list(rows)[:limit]

    logger.info(
        "Audit logs query returned %s entries (has_more=%s)",
        len(trimmed),
        has_more,
        extra={
            "table": table_name,
            "action": action,
            "since": since_str,
            "result_count": len(trimmed),
        },
    )

    next_cursor = encode_cursor(trimmed[-1].id) if has_more and trimmed else None
    return json_response(
        200,
        {
            "items": [_serialize_audit_log(row) for row in trimmed],
            "next_cursor": next_cursor,
        },
        event=event,
    )


def _serialize_audit_log(entry: AuditLog) -> dict[str, Any]:
    old_values = entry.old_values or {}
    new_values = entry.new_values or {}

    def redact_values(values: dict[str, Any]) -> dict[str, Any]:
        redacted: dict[str, Any] = {}
        for key, value in values.items():
            if key.lower() in AUDIT_REDACTED_FIELDS:
                redacted[key] = "***REDACTED***"
            else:
                redacted[key] = value
        return redacted

    return {
        "id": str(entry.id),
        "table_name": entry.table_name,
        "record_id": entry.record_id,
        "action": entry.action,
        "user_id": entry.user_id,
        "request_id": entry.request_id,
        "old_values": redact_values(dict(old_values)),
        "new_values": redact_values(dict(new_values)),
        "changed_fields": entry.changed_fields,
        "timestamp": entry.timestamp,
        "source": entry.source,
        "ip_address": entry.ip_address,
        "user_agent": entry.user_agent,
    }
