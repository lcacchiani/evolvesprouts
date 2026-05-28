"""Tests for PUT /v1/forms/{form_slug}/answers."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import public_forms as pf
from app.services import form_responses_store as store


@pytest.fixture(autouse=True)
def reset_form_store() -> None:
    store.reset_table_for_tests()
    yield
    store.reset_table_for_tests()


def _event(api_gateway_event: Any, *, body: dict[str, Any]) -> dict[str, Any]:
    return api_gateway_event(
        method="PUT",
        path="/www/v1/forms/workshop-feedback/answers",
        body=json.dumps(body),
        headers={"content-type": "application/json"},
    )


def test_put_form_answer_persists_select(api_gateway_event: Any, mock_env: Any) -> None:
    table = MagicMock()
    table.get_item.return_value = {"Item": None}
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    body = {
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "questionId": "rating",
        "questionType": "select",
        "selectedOption": "Excellent",
    }
    resp = pf.handle_public_forms_request(
        _event(api_gateway_event, body=body),
        "PUT",
        "/www/v1/forms/workshop-feedback/answers",
    )
    assert resp["statusCode"] == 200
    item = table.put_item.call_args.kwargs["Item"]
    assert item["selectedOption"] == "Excellent"
    assert item["pk"] == "FORM#workshop-feedback"


def test_put_form_answer_persists_text(api_gateway_event: Any, mock_env: Any) -> None:
    table = MagicMock()
    table.get_item.return_value = {"Item": None}
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    body = {
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "questionId": "comments",
        "questionType": "text",
        "freeText": "Great workshop",
    }
    resp = pf.handle_public_forms_request(
        _event(api_gateway_event, body=body),
        "PUT",
        "/www/v1/forms/workshop-feedback/answers",
    )
    assert resp["statusCode"] == 200
    item = table.put_item.call_args.kwargs["Item"]
    assert item["freeText"] == "Great workshop"


def test_put_form_answer_rejects_truefalse(api_gateway_event: Any, mock_env: Any) -> None:
    table = MagicMock()
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    body = {
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "questionId": "rating",
        "questionType": "truefalse",
        "booleanAnswer": True,
    }
    resp = pf.handle_public_forms_request(
        _event(api_gateway_event, body=body),
        "PUT",
        "/www/v1/forms/workshop-feedback/answers",
    )
    assert resp["statusCode"] == 400
