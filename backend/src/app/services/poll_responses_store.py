"""DynamoDB persistence for training-site poll answers (shared table, all polls)."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any
from collections.abc import Mapping

import boto3
from botocore.exceptions import ClientError

from app.exceptions import AppError
from app.utils.logging import get_logger

logger = get_logger(__name__)

_TABLE_ENV = "POLL_RESPONSES_TABLE_NAME"
_PK_PREFIX = "POLL#"
_SK_PREFIX = "SESSION#"
_SK_QUESTION_SEP = "#Q#"

_dynamodb = None
_table = None


def _table_name() -> str:
    name = os.environ.get(_TABLE_ENV, "").strip()
    if not name:
        raise AppError(
            "Poll responses table is not configured",
            status_code=500,
        )
    return name


def _get_table():
    global _dynamodb, _table
    if _table is None:
        _dynamodb = boto3.resource("dynamodb")
        _table = _dynamodb.Table(_table_name())
    return _table


def _partition_key(*, poll_slug: str) -> str:
    return f"{_PK_PREFIX}{poll_slug}"


def _sort_key(*, session_id: str, question_id: str) -> str:
    return f"{_SK_PREFIX}{session_id}{_SK_QUESTION_SEP}{question_id}"


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def upsert_poll_answer(
    *,
    poll_slug: str,
    session_id: str,
    question_id: str,
    question_type: str,
    selection_mode: str | None,
    answer_ids: list[str],
    other_text: str | None,
    free_text: str | None,
) -> dict[str, Any]:
    """Persist one question answer; overwrites prior value for the same session/question."""
    table = _get_table()
    key = {
        "pk": _partition_key(poll_slug=poll_slug),
        "sk": _sort_key(session_id=session_id, question_id=question_id),
    }
    now = _now_iso()
    item: dict[str, Any] = {
        **key,
        "pollSlug": poll_slug,
        "sessionId": session_id,
        "questionId": question_id,
        "questionType": question_type,
        "updatedAt": now,
    }
    if selection_mode is not None:
        item["selectionMode"] = selection_mode
    if answer_ids:
        item["answerIds"] = answer_ids
    if other_text:
        item["otherText"] = other_text
    if free_text:
        item["freeText"] = free_text

    try:
        existing = table.get_item(Key=key).get("Item")
        if existing and existing.get("createdAt"):
            item["createdAt"] = existing["createdAt"]
        else:
            item["createdAt"] = now
        table.put_item(Item=item)
    except ClientError:
        logger.exception(
            "Failed to persist poll answer",
            extra={
                "poll_slug": poll_slug,
                "question_id": question_id,
            },
        )
        raise AppError(
            "Failed to persist poll answer",
            status_code=500,
        ) from None

    return {
        "pollSlug": poll_slug,
        "sessionId": session_id,
        "questionId": question_id,
        "updatedAt": now,
    }


def reset_table_for_tests() -> None:
    """Clear cached table handle (unit tests only)."""
    global _dynamodb, _table
    _dynamodb = None
    _table = None


def configure_table_for_tests(table: Any) -> None:
    """Inject a mock table (unit tests only)."""
    global _table
    _table = table
