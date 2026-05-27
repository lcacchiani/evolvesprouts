"""Public training poll answer persistence (DynamoDB)."""

from __future__ import annotations

import re
from typing import Any
from collections.abc import Mapping

from app.api.admin_request import parse_body
from app.api.validators import validate_email
from app.exceptions import ValidationError
from app.services.poll_responses_store import upsert_poll_answer
from app.utils import json_response
from app.utils.logging import get_logger
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN

logger = get_logger(__name__)

_ANSWERS_SUFFIX = "/answers"
_POLL_API_PREFIX = "/v1/polls/"
_WWW_POLL_API_PREFIX = "/www/v1/polls/"

_MAX_SELECTED_OPTION = 500
_MAX_FREE_TEXT = 4000

_QUESTION_ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_SESSION_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

_SELECT_TYPES = frozenset({"select"})
_TRUEFALSE_TYPES = frozenset({"truefalse"})
_TEXT_TYPES = frozenset({"text"})
_EMAIL_TYPES = frozenset({"email"})


def handle_public_polls_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Route poll API requests under /v1/polls/* and /www/v1/polls/*."""
    parsed = _parse_poll_answers_path(path)
    if parsed is None:
        return json_response(404, {"error": "Not found"}, event=event)

    poll_slug, _suffix = parsed
    if method == "PUT" and path.endswith(_ANSWERS_SUFFIX):
        return _handle_put_poll_answer(event, poll_slug=poll_slug)

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _parse_poll_answers_path(path: str) -> tuple[str, str] | None:
    normalized = path.rstrip("/")
    if not normalized.endswith(_ANSWERS_SUFFIX):
        return None

    if normalized.startswith(_WWW_POLL_API_PREFIX):
        remainder = normalized[len(_WWW_POLL_API_PREFIX) : -len(_ANSWERS_SUFFIX)]
    elif normalized.startswith(_POLL_API_PREFIX):
        remainder = normalized[len(_POLL_API_PREFIX) : -len(_ANSWERS_SUFFIX)]
    else:
        return None

    remainder = remainder.strip("/")
    if "/" in remainder or not remainder:
        return None
    if not PUBLIC_INSTANCE_SLUG_PATTERN.match(remainder):
        return None
    return remainder, _ANSWERS_SUFFIX


def _handle_put_poll_answer(
    event: Mapping[str, Any],
    *,
    poll_slug: str,
) -> dict[str, Any]:
    try:
        body = parse_body(event)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    try:
        normalized = _validate_put_body(body, poll_slug=poll_slug)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    result = upsert_poll_answer(**normalized)
    logger.info(
        "Persisted poll answer",
        extra={
            "poll_slug": poll_slug,
            "question_id": normalized["question_id"],
        },
    )
    return json_response(
        200,
        {
            "pollSlug": result["pollSlug"],
            "sessionId": result["sessionId"],
            "questionId": result["questionId"],
            "updatedAt": result["updatedAt"],
        },
        event=event,
    )


def _validate_put_body(
    body: Mapping[str, Any],
    *,
    poll_slug: str,
) -> dict[str, Any]:
    session_id = _require_session_id(body.get("sessionId"))
    question_id = _require_question_id(body.get("questionId"))
    question_type = _require_question_type(body.get("questionType"))

    body_poll_slug = body.get("pollSlug")
    if body_poll_slug is not None:
        if not isinstance(body_poll_slug, str):
            raise ValidationError("pollSlug must be a string")
        normalized_body_slug = body_poll_slug.strip()
        if normalized_body_slug != poll_slug:
            raise ValidationError("pollSlug does not match URL")

    base = {
        "poll_slug": poll_slug,
        "session_id": session_id,
        "question_id": question_id,
        "question_type": question_type,
    }

    if question_type in _SELECT_TYPES:
        selected_option = _require_non_empty_string(
            body.get("selectedOption"),
            field="selectedOption",
        )
        if len(selected_option) > _MAX_SELECTED_OPTION:
            raise ValidationError(
                f"selectedOption must be at most {_MAX_SELECTED_OPTION} characters"
            )
        return {
            **base,
            "selected_option": selected_option,
            "boolean_answer": None,
            "free_text": None,
        }

    if question_type in _TRUEFALSE_TYPES:
        boolean_answer = _require_boolean(body.get("booleanAnswer"))
        return {
            **base,
            "selected_option": None,
            "boolean_answer": boolean_answer,
            "free_text": None,
        }

    free_text = _require_non_empty_string(body.get("freeText"), field="freeText")
    if len(free_text) > _MAX_FREE_TEXT:
        raise ValidationError(f"freeText must be at most {_MAX_FREE_TEXT} characters")

    if question_type in _EMAIL_TYPES:
        validated_email = validate_email(free_text)
        if not validated_email:
            raise ValidationError("freeText must be a valid email address")
        free_text = validated_email

    return {
        **base,
        "selected_option": None,
        "boolean_answer": None,
        "free_text": free_text,
    }


def _require_session_id(value: Any) -> str:
    if not isinstance(value, str):
        raise ValidationError("sessionId is required")
    normalized = value.strip()
    if not _SESSION_ID_PATTERN.match(normalized):
        raise ValidationError("sessionId must be a UUID")
    return normalized.lower()


def _require_question_id(value: Any) -> str:
    if not isinstance(value, str):
        raise ValidationError("questionId is required")
    normalized = value.strip()
    if not _QUESTION_ID_PATTERN.match(normalized):
        raise ValidationError("questionId must be a kebab-case identifier")
    return normalized


def _require_question_type(value: Any) -> str:
    if not isinstance(value, str):
        raise ValidationError("questionType is required")
    normalized = value.strip().lower()
    allowed = _SELECT_TYPES | _TRUEFALSE_TYPES | _TEXT_TYPES | _EMAIL_TYPES
    if normalized not in allowed:
        raise ValidationError("questionType must be select, truefalse, text, or email")
    return normalized


def _require_boolean(value: Any) -> bool:
    if not isinstance(value, bool):
        raise ValidationError("booleanAnswer must be a boolean")
    return value


def _require_non_empty_string(value: Any, *, field: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field} is required")
    normalized = value.strip()
    if not normalized:
        raise ValidationError(f"{field} is required")
    return normalized
