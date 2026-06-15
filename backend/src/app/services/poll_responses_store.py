"""DynamoDB persistence for training-site poll answers (shared table, all polls)."""

from __future__ import annotations

import os
import re
import time
from collections import Counter
from datetime import UTC, datetime
from collections.abc import Mapping
from typing import Any, TypedDict

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from app.exceptions import AppError, RateLimitError
from app.utils.logging import get_logger

logger = get_logger(__name__)

_TABLE_ENV = "POLL_RESPONSES_TABLE_NAME"
_PK_PREFIX = "POLL#"
_SK_PREFIX = "SESSION#"
_SK_QUESTION_SEP = "#Q#"
_SK_CONTROL = "CONTROL"
_SK_RATELIMIT_PREFIX = "RATELIMIT#"

# Per-session and per-IP write caps for poll answer PUTs (rolling window via TTL).
_SESSION_WRITE_LIMIT = 120
_IP_WRITE_LIMIT = 300
_RATE_LIMIT_TTL_SECONDS = 3600

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
    selected_options: list[str] | None = None,
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
    if selected_options is not None:
        item["selectedOptions"] = selected_options
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


def _is_poll_answer_item(item: Mapping[str, Any]) -> bool:
    sk = item.get("sk")
    if not isinstance(sk, str):
        return True
    if sk == _SK_CONTROL:
        return False
    if sk.startswith(_SK_RATELIMIT_PREFIX):
        return False
    return sk.startswith(_SK_PREFIX)


def _parse_question_options(
    raw: Any,
) -> dict[str, dict[str, Any]] | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return None
    parsed: dict[str, dict[str, Any]] = {}
    for question_id, entry in raw.items():
        if not isinstance(question_id, str) or not _QUESTION_ID_PATTERN.match(
            question_id.strip()
        ):
            continue
        if not isinstance(entry, dict):
            continue
        question_type = entry.get("type")
        if not isinstance(question_type, str):
            continue
        normalized_type = question_type.strip().lower()
        options_raw = entry.get("options")
        options: list[str] | None = None
        if options_raw is not None:
            if not isinstance(options_raw, list):
                continue
            options = [
                str(value).strip()
                for value in options_raw
                if isinstance(value, str) and str(value).strip()
            ]
        parsed[question_id.strip()] = {
            "type": normalized_type,
            "options": options,
        }
    return parsed or None


_QUESTION_ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def aggregate_poll_question_results(
    *,
    poll_slug: str,
    question_id: str,
    question_type: str,
) -> dict[str, Any]:
    """Return live aggregate counts for one poll question across all sessions."""
    table = _get_table()
    items = _query_poll_items(table=table, poll_slug=poll_slug)
    matching = [
        item
        for item in items
        if _is_poll_answer_item(item) and item.get("questionId") == question_id
    ]
    buckets: list[_PollResultBucket]

    responses: list[str] = []

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
        total = sum(bucket["count"] for bucket in buckets)
    elif question_type == "multiselect":
        counts = Counter[str]()
        total = 0
        for item in matching:
            raw_options = item.get("selectedOptions")
            if not isinstance(raw_options, list):
                continue
            options = [
                str(value).strip()
                for value in raw_options
                if isinstance(value, str) and str(value).strip()
            ]
            if not options:
                continue
            total += 1
            counts.update(options)
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
        total = sum(bucket["count"] for bucket in buckets)
    elif question_type in ("text", "email"):
        buckets = []
        for item in matching:
            value = item.get("freeText")
            if isinstance(value, str):
                normalized = value.strip()
                if normalized:
                    responses.append(normalized)
        total = len(responses)
    else:
        buckets = []
        total = 0

    result: dict[str, Any] = {
        "pollSlug": poll_slug,
        "questionId": question_id,
        "questionType": question_type,
        "totalResponses": total,
        "buckets": buckets,
    }
    if responses:
        result["responses"] = responses
    return result


def get_poll_control_state(*, poll_slug: str) -> dict[str, Any]:
    """Return facilitator toggles for which questions are open to respondents."""
    table = _get_table()
    key = {
        "pk": _partition_key(poll_slug=poll_slug),
        "sk": _SK_CONTROL,
    }
    try:
        item = table.get_item(Key=key).get("Item")
    except ClientError:
        logger.exception(
            "Failed to load poll control state",
            extra={"poll_slug": poll_slug},
        )
        raise AppError(
            "Failed to load poll control state",
            status_code=500,
        ) from None

    enabled: list[str] = []
    if item and isinstance(item.get("enabledQuestionIds"), list):
        for value in item["enabledQuestionIds"]:
            if isinstance(value, str) and value.strip():
                enabled.append(value.strip())

    updated_at = item.get("updatedAt") if isinstance(item, dict) else None
    question_options = (
        _parse_question_options(item.get("questionOptions"))
        if isinstance(item, dict)
        else None
    )
    response: dict[str, Any] = {
        "pollSlug": poll_slug,
        "enabledQuestionIds": enabled,
    }
    if question_options:
        response["questionOptions"] = question_options
    if isinstance(updated_at, str):
        response["updatedAt"] = updated_at
    return response


def put_poll_control_state(
    *,
    poll_slug: str,
    enabled_question_ids: list[str],
    question_options: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Replace the set of questions respondents may answer (default is none)."""
    table = _get_table()
    key = {
        "pk": _partition_key(poll_slug=poll_slug),
        "sk": _SK_CONTROL,
    }
    now = _now_iso()
    item: dict[str, Any] = {
        **key,
        "pollSlug": poll_slug,
        "enabledQuestionIds": enabled_question_ids,
        "updatedAt": now,
    }
    if question_options:
        item["questionOptions"] = question_options
    try:
        existing = table.get_item(Key=key).get("Item")
        if existing and existing.get("createdAt"):
            item["createdAt"] = existing["createdAt"]
        else:
            item["createdAt"] = now
        table.put_item(Item=item)
    except ClientError:
        logger.exception(
            "Failed to persist poll control state",
            extra={"poll_slug": poll_slug},
        )
        raise AppError(
            "Failed to persist poll control state",
            status_code=500,
        ) from None

    result: dict[str, Any] = {
        "pollSlug": poll_slug,
        "enabledQuestionIds": enabled_question_ids,
        "updatedAt": now,
    }
    if question_options:
        result["questionOptions"] = question_options
    return result


def check_poll_write_rate_limit(
    *,
    poll_slug: str,
    session_id: str,
    client_ip: str | None,
) -> None:
    """Reject excessive poll answer writes per session and per client IP."""
    table = _get_table()
    now_epoch = int(time.time())
    expires_at = now_epoch + _RATE_LIMIT_TTL_SECONDS
    scopes: list[tuple[str, int]] = [
        (f"SESSION#{session_id}", _SESSION_WRITE_LIMIT),
    ]
    normalized_ip = (client_ip or "").strip()
    if normalized_ip:
        scopes.append((f"IP#{normalized_ip}", _IP_WRITE_LIMIT))

    for scope_key, limit in scopes:
        key = {
            "pk": _partition_key(poll_slug=poll_slug),
            "sk": f"{_SK_RATELIMIT_PREFIX}{scope_key}",
        }
        try:
            table.update_item(
                Key=key,
                UpdateExpression=(
                    "ADD writeCount :inc SET expiresAt = :expires, updatedAt = :updated"
                ),
                ConditionExpression=(
                    "attribute_not_exists(writeCount) OR writeCount < :limit"
                ),
                ExpressionAttributeValues={
                    ":inc": 1,
                    ":expires": expires_at,
                    ":updated": _now_iso(),
                    ":limit": limit,
                },
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code == "ConditionalCheckFailedException":
                raise RateLimitError("poll_write_rate_limit_exceeded") from None
            logger.exception(
                "Failed to update poll write rate limit counter",
                extra={"poll_slug": poll_slug, "scope": scope_key},
            )
            raise AppError(
                "Failed to enforce poll write rate limit",
                status_code=500,
            ) from None


def _count_boolean_answers(items: list[dict[str, Any]], *, expected: bool) -> int:
    total = 0
    for item in items:
        value = item.get("booleanAnswer")
        if isinstance(value, bool) and value is expected:
            total += 1
    return total


def list_poll_summaries() -> list[dict[str, Any]]:
    """Return distinct poll slugs with answer row counts from DynamoDB."""
    table = _get_table()
    slug_counts: Counter[str] = Counter()
    scan_kwargs: dict[str, Any] = {
        "ProjectionExpression": "pk, pollSlug",
    }
    try:
        while True:
            response = table.scan(**scan_kwargs)
            for item in response.get("Items", []):
                if not _is_poll_answer_item(item):
                    continue
                slug = _extract_poll_slug_from_item(item)
                if slug:
                    slug_counts[slug] += 1
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key
    except ClientError:
        logger.exception("Failed to scan poll responses table")
        raise AppError(
            "Failed to list poll responses",
            status_code=500,
        ) from None

    return [
        {"pollSlug": slug, "answerCount": count}
        for slug, count in sorted(slug_counts.items())
    ]


def list_poll_answers_for_session(
    *,
    poll_slug: str,
    session_id: str,
) -> list[dict[str, Any]]:
    """Return answer rows for one poll session (respondent resume)."""
    table = _get_table()
    try:
        items = _query_poll_items(table=table, poll_slug=poll_slug)
    except ClientError:
        logger.exception(
            "Failed to query poll session answers",
            extra={"poll_slug": poll_slug},
        )
        raise AppError(
            "Failed to list poll session answers",
            status_code=500,
        ) from None

    sk_prefix = f"{_SK_PREFIX}{session_id}{_SK_QUESTION_SEP}"
    matching = [
        item
        for item in items
        if isinstance(item.get("sk"), str) and item["sk"].startswith(sk_prefix)
    ]
    serialized = [serialize_poll_answer_item(item) for item in matching]
    serialized.sort(
        key=lambda row: str(row.get("questionId") or ""),
    )
    return serialized


def list_poll_answers(*, poll_slug: str) -> list[dict[str, Any]]:
    """Return all answer rows for one poll, sorted by updated time descending."""
    table = _get_table()
    try:
        items = _query_poll_items(table=table, poll_slug=poll_slug)
    except ClientError:
        logger.exception(
            "Failed to query poll answers",
            extra={"poll_slug": poll_slug},
        )
        raise AppError(
            "Failed to list poll answers",
            status_code=500,
        ) from None

    answer_items = [item for item in items if _is_poll_answer_item(item)]
    serialized = [serialize_poll_answer_item(item) for item in answer_items]
    serialized.sort(
        key=lambda row: (
            str(row.get("updatedAt") or ""),
            str(row.get("sessionId") or ""),
            str(row.get("questionId") or ""),
        ),
        reverse=True,
    )
    return serialized


def serialize_poll_answer_item(item: Mapping[str, Any]) -> dict[str, Any]:
    """Map a DynamoDB poll answer item to an admin API payload."""
    row: dict[str, Any] = {
        "pollSlug": item.get("pollSlug"),
        "sessionId": item.get("sessionId"),
        "questionId": item.get("questionId"),
        "questionType": item.get("questionType"),
        "createdAt": item.get("createdAt"),
        "updatedAt": item.get("updatedAt"),
    }
    selected_option = item.get("selectedOption")
    if isinstance(selected_option, str):
        row["selectedOption"] = selected_option
    selected_options = item.get("selectedOptions")
    if isinstance(selected_options, list):
        normalized_options = [
            str(value).strip()
            for value in selected_options
            if isinstance(value, str) and str(value).strip()
        ]
        if normalized_options:
            row["selectedOptions"] = normalized_options
    boolean_answer = item.get("booleanAnswer")
    if isinstance(boolean_answer, bool):
        row["booleanAnswer"] = boolean_answer
    free_text = item.get("freeText")
    if isinstance(free_text, str):
        row["freeText"] = free_text
    return row


def clear_poll_answers(*, poll_slug: str) -> int:
    """Delete all answer rows for one poll. Returns the number of rows removed."""
    table = _get_table()
    try:
        items = _query_poll_items(table=table, poll_slug=poll_slug)
    except ClientError:
        logger.exception(
            "Failed to query poll answers for clear",
            extra={"poll_slug": poll_slug},
        )
        raise AppError(
            "Failed to clear poll answers",
            status_code=500,
        ) from None

    answer_items = [item for item in items if _is_poll_answer_item(item)]
    if not answer_items:
        return 0

    try:
        with table.batch_writer() as batch:
            for item in answer_items:
                batch.delete_item(
                    Key={
                        "pk": item["pk"],
                        "sk": item["sk"],
                    }
                )
    except ClientError:
        logger.exception(
            "Failed to delete poll answers",
            extra={"poll_slug": poll_slug},
        )
        raise AppError(
            "Failed to clear poll answers",
            status_code=500,
        ) from None

    return len(answer_items)


def _extract_poll_slug_from_item(item: Mapping[str, Any]) -> str | None:
    poll_slug = item.get("pollSlug")
    if isinstance(poll_slug, str):
        normalized = poll_slug.strip()
        if normalized:
            return normalized
    pk = item.get("pk")
    if isinstance(pk, str) and pk.startswith(_PK_PREFIX):
        normalized = pk[len(_PK_PREFIX) :].strip()
        return normalized or None
    return None


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
