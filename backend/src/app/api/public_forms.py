"""Public training form answer persistence (DynamoDB)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from app.api.admin_request import parse_body
from app.api.validators import validate_email
from app.exceptions import ValidationError
from app.services.form_responses_store import upsert_form_answer
from app.utils import json_response
from app.utils.logging import get_logger
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN

logger = get_logger(__name__)

_ANSWERS_SUFFIX = "/answers"
_FORM_API_PREFIX = "/v1/forms/"
_WWW_FORM_API_PREFIX = "/www/v1/forms/"

_MAX_SELECTED_OPTION = 500
_MAX_FREE_TEXT = 4000

_QUESTION_ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_SESSION_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

_SELECT_TYPES = frozenset({"select"})
_TEXT_TYPES = frozenset({"text"})
_EMAIL_TYPES = frozenset({"email"})


def handle_public_forms_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Route form API requests under /v1/forms/* and /www/v1/forms/*."""
    answers = _parse_form_answers_path(path)
    if answers is not None:
        form_slug, _suffix = answers
        if method == "PUT":
            return _handle_put_form_answer(event, form_slug=form_slug)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _parse_form_path_remainder(path: str) -> str | None:
    normalized = path.rstrip("/")
    if normalized.startswith(_WWW_FORM_API_PREFIX):
        return normalized[len(_WWW_FORM_API_PREFIX) :]
    if normalized.startswith(_FORM_API_PREFIX):
        return normalized[len(_FORM_API_PREFIX) :]
    return None


def _parse_form_answers_path(path: str) -> tuple[str, str] | None:
    remainder = _parse_form_path_remainder(path)
    if remainder is None or not remainder.endswith(_ANSWERS_SUFFIX):
        return None
    form_slug = remainder[: -len(_ANSWERS_SUFFIX)].strip("/")
    if "/" in form_slug or not form_slug:
        return None
    if not PUBLIC_INSTANCE_SLUG_PATTERN.match(form_slug):
        return None
    return form_slug, _ANSWERS_SUFFIX


def _handle_put_form_answer(
    event: Mapping[str, Any],
    *,
    form_slug: str,
) -> dict[str, Any]:
    try:
        body = parse_body(event)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    try:
        normalized = _validate_put_body(body, form_slug=form_slug)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    result = upsert_form_answer(**normalized)
    logger.info(
        "Persisted form answer",
        extra={
            "form_slug": form_slug,
            "question_id": normalized["question_id"],
        },
    )
    return json_response(
        200,
        {
            "formSlug": result["formSlug"],
            "sessionId": result["sessionId"],
            "questionId": result["questionId"],
            "updatedAt": result["updatedAt"],
        },
        event=event,
    )


def _validate_put_body(
    body: Mapping[str, Any],
    *,
    form_slug: str,
) -> dict[str, Any]:
    session_id = _require_session_id(body.get("sessionId"))
    question_id = _require_question_id(body.get("questionId"))
    question_type = _require_question_type(body.get("questionType"))

    body_form_slug = body.get("formSlug")
    if body_form_slug is not None:
        if not isinstance(body_form_slug, str):
            raise ValidationError("formSlug must be a string")
        normalized_body_slug = body_form_slug.strip()
        if normalized_body_slug != form_slug:
            raise ValidationError("formSlug does not match URL")

    base = {
        "form_slug": form_slug,
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
    allowed = _SELECT_TYPES | _TEXT_TYPES | _EMAIL_TYPES
    if normalized not in allowed:
        raise ValidationError("questionType must be select, text, or email")
    return normalized


def _require_non_empty_string(value: Any, *, field: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field} is required")
    normalized = value.strip()
    if not normalized:
        raise ValidationError(f"{field} is required")
    return normalized
