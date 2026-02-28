from __future__ import annotations

import base64

import pytest

from app.api.admin_request import _parse_body
from app.exceptions import ValidationError


def test_parse_body_rejects_invalid_base64_payload() -> None:
    event = {
        "body": "%%%not-base64%%%",
        "isBase64Encoded": True,
    }

    with pytest.raises(ValidationError, match="Request body is not valid base64"):
        _parse_body(event)


def test_parse_body_rejects_invalid_json_payload() -> None:
    event = {
        "body": "{invalid-json",
        "isBase64Encoded": False,
    }

    with pytest.raises(ValidationError, match="Request body must be valid JSON"):
        _parse_body(event)


def test_parse_body_decodes_base64_json_payload() -> None:
    payload = base64.b64encode(b'{"title":"Guide"}').decode("utf-8")
    event = {
        "body": payload,
        "isBase64Encoded": True,
    }

    assert _parse_body(event) == {"title": "Guide"}
