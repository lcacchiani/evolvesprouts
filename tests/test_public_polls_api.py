"""Tests for PUT /v1/polls/{poll_slug}/answers."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.api import public_polls as pp
from app.services import poll_responses_store as store


@pytest.fixture(autouse=True)
def reset_poll_store() -> None:
    store.reset_table_for_tests()
    yield
    store.reset_table_for_tests()


def _event(api_gateway_event: Any, *, body: dict[str, Any]) -> dict[str, Any]:
    return api_gateway_event(
        method="PUT",
        path="/www/v1/polls/workshop-food-jun-26/answers",
        body=json.dumps(body),
        headers={"content-type": "application/json"},
    )


def test_put_poll_answer_persists_choice(api_gateway_event: Any, mock_env: Any) -> None:
    table = MagicMock()
    table.get_item.return_value = {"Item": None}
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    body = {
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "questionId": "meal-preference",
        "questionType": "choice",
        "selectionMode": "single",
        "answerIds": ["vegetarian"],
    }
    resp = pp.handle_public_polls_request(_event(api_gateway_event, body=body), "PUT", "/www/v1/polls/workshop-food-jun-26/answers")
    assert resp["statusCode"] == 200
    payload = json.loads(resp["body"])
    assert payload["pollSlug"] == "workshop-food-jun-26"
    assert payload["questionId"] == "meal-preference"
    table.put_item.assert_called_once()


def test_put_poll_answer_persists_text(api_gateway_event: Any, mock_env: Any) -> None:
    table = MagicMock()
    table.get_item.return_value = {"Item": None}
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    body = {
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "questionId": "dietary-notes",
        "questionType": "text",
        "freeText": "No peanuts",
    }
    resp = pp.handle_public_polls_request(_event(api_gateway_event, body=body), "PUT", "/www/v1/polls/workshop-food-jun-26/answers")
    assert resp["statusCode"] == 200
    item = table.put_item.call_args.kwargs["Item"]
    assert item["freeText"] == "No peanuts"


def test_put_poll_answer_rejects_invalid_session(api_gateway_event: Any) -> None:
    body = {
        "sessionId": "not-a-uuid",
        "questionId": "meal-preference",
        "questionType": "choice",
        "selectionMode": "single",
        "answerIds": ["vegetarian"],
    }
    resp = pp.handle_public_polls_request(_event(api_gateway_event, body=body), "PUT", "/www/v1/polls/workshop-food-jun-26/answers")
    assert resp["statusCode"] == 400


def test_put_poll_answer_rejects_unknown_path(api_gateway_event: Any) -> None:
    event = api_gateway_event(
        method="PUT",
        path="/www/v1/polls/workshop-food-jun-26/submit",
        body="{}",
        headers={"content-type": "application/json"},
    )
    resp = pp.handle_public_polls_request(event, "PUT", "/www/v1/polls/workshop-food-jun-26/submit")
    assert resp["statusCode"] == 404
