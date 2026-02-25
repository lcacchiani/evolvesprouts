from __future__ import annotations

import pytest

from app.exceptions import ValidationError
from app.utils.responses import validate_content_type


def test_validate_content_type_allows_bodyless_post() -> None:
    event = {
        "httpMethod": "POST",
        "headers": {},
        "body": "",
    }

    validate_content_type(event)


def test_validate_content_type_requires_header_for_post_with_body() -> None:
    event = {
        "httpMethod": "POST",
        "headers": {},
        "body": "{}",
    }

    with pytest.raises(
        ValidationError, match="Content-Type header is required for requests with a body"
    ):
        validate_content_type(event)


def test_validate_content_type_rejects_non_json_content_type() -> None:
    event = {
        "httpMethod": "POST",
        "headers": {"Content-Type": "text/plain"},
        "body": "{}",
    }

    with pytest.raises(ValidationError, match="Content-Type must be application/json"):
        validate_content_type(event)
