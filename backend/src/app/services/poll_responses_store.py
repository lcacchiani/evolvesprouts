"""DynamoDB persistence for training-site poll answers (shared table, all polls)."""

from __future__ import annotations

import os
from collections import Counter
from datetime import UTC, datetime
from typing import Any, TypedDict

import boto3
from boto3.dynamodb.conditions import Key
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


class _PollResultBucket(TypedDict):
    label: str
    count: int


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
    selected_option: str | None = None,
    boolean_answer: bool | None = None,
    free_text: str | None = None,
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
    if selected_option is not None:
        item["selectedOption"] = selected_option
    if boolean_answer is not None:
        item["booleanAnswer"] = boolean_answer
    if free_text is not None:
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


def aggregate_poll_question_results(
    *,
    poll_slug: str,
    question_id: str,
    question_type: str,
) -> dict[str, Any]:
    """Return live aggregate counts for one poll question across all sessions."""
    table = _get_table()
    items = _query_poll_items(table=table, poll_slug=poll_slug)
    matching = [item for item in items if item.get("questionId") == question_id]
    buckets: list[_PollResultBucket]

    if question_type == "select":
        counts = Counter(
            str(item["selectedOption"]).strip()
            for item in matching
            if isinstance(item.get("selectedOption"), str)
            and str(item["selectedOption"]).strip()
        )
        buckets = [
            _PollResultBucket(label=label, count=count)
            for label, count in sorted(
                counts.items(), key=lambda pair: (-pair[1], pair[0])
            )
        ]
    elif question_type == "truefalse":
        true_count = _count_boolean_answers(matching, expected=True)
        false_count = _count_boolean_answers(matching, expected=False)
        buckets = [
            _PollResultBucket(label="true", count=true_count),
            _PollResultBucket(label="false", count=false_count),
        ]
    else:
        buckets = []

    total = sum(bucket["count"] for bucket in buckets)
    return {
        "pollSlug": poll_slug,
        "questionId": question_id,
        "questionType": question_type,
        "totalResponses": total,
        "buckets": buckets,
    }


def _count_boolean_answers(items: list[dict[str, Any]], *, expected: bool) -> int:
    total = 0
    for item in items:
        value = item.get("booleanAnswer")
        if isinstance(value, bool) and value is expected:
            total += 1
    return total


def _query_poll_items(*, table: Any, poll_slug: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    query_kwargs: dict[str, Any] = {
        "KeyConditionExpression": Key("pk").eq(_partition_key(poll_slug=poll_slug)),
    }
    while True:
        response = table.query(**query_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    return items


def reset_table_for_tests() -> None:
    """Clear cached table handle (unit tests only)."""
    global _dynamodb, _table
    _dynamodb = None
    _table = None


def configure_table_for_tests(table: Any) -> None:
    """Inject a mock table (unit tests only)."""
    global _table
    _table = table
