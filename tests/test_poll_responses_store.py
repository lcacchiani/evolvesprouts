"""Regression tests for poll_responses_store rate limiting and clear behavior."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.services import poll_responses_store as store


@pytest.fixture(autouse=True)
def _reset_store_table() -> None:
    store.reset_table_for_tests()
    yield
    store.reset_table_for_tests()


def test_check_poll_write_rate_limit_uses_hourly_window_bucket(
    monkeypatch: pytest.MonkeyPatch,
    mock_env: Any,
) -> None:
    table = MagicMock()
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    fixed_epoch = 1_700_000_123
    monkeypatch.setattr(store.time, "time", lambda: fixed_epoch)

    store.check_poll_write_rate_limit(
        poll_slug="workshop-food-jun-26",
        session_id="550e8400-e29b-41d4-a716-446655440000",
    )

    table.update_item.assert_called_once()
    key = table.update_item.call_args.kwargs["Key"]
    window_id = fixed_epoch // store._RATE_LIMIT_WINDOW_SECONDS
    assert key == {
        "pk": "POLL#workshop-food-jun-26",
        "sk": (
            "RATELIMIT#SESSION#550e8400-e29b-41d4-a716-446655440000" f"#W#{window_id}"
        ),
    }
    values = table.update_item.call_args.kwargs["ExpressionAttributeValues"]
    assert values[":limit"] == store._SESSION_WRITE_LIMIT
    assert values[":expires"] == fixed_epoch + store._RATE_LIMIT_TTL_SECONDS


def test_check_poll_write_rate_limit_uses_new_bucket_each_hour(
    monkeypatch: pytest.MonkeyPatch,
    mock_env: Any,
) -> None:
    table = MagicMock()
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    epoch_hour_one = 3_600
    epoch_hour_two = 7_200
    monkeypatch.setattr(store.time, "time", lambda: epoch_hour_one)
    store.check_poll_write_rate_limit(
        poll_slug="workshop-food-jun-26",
        session_id="550e8400-e29b-41d4-a716-446655440000",
    )
    first_sk = table.update_item.call_args.kwargs["Key"]["sk"]

    monkeypatch.setattr(store.time, "time", lambda: epoch_hour_two)
    store.check_poll_write_rate_limit(
        poll_slug="workshop-food-jun-26",
        session_id="550e8400-e29b-41d4-a716-446655440000",
    )
    second_sk = table.update_item.call_args.kwargs["Key"]["sk"]

    assert first_sk != second_sk
    assert first_sk.endswith("#W#1")
    assert second_sk.endswith("#W#2")


def test_clear_poll_answers_deletes_rate_limit_rows(
    mock_env: Any,
) -> None:
    table = MagicMock()
    table.query.return_value = {
        "Items": [
            {
                "pk": "POLL#workshop-food-jun-26",
                "sk": "CONTROL",
            },
            {
                "pk": "POLL#workshop-food-jun-26",
                "sk": "SESSION#550e8400-e29b-41d4-a716-446655440000#Q#role",
            },
            {
                "pk": "POLL#workshop-food-jun-26",
                "sk": "RATELIMIT#SESSION#550e8400-e29b-41d4-a716-446655440000#W#471111",
            },
        ]
    }
    batch = MagicMock()
    batch.__enter__ = MagicMock(return_value=batch)
    batch.__exit__ = MagicMock(return_value=False)
    table.batch_writer.return_value = batch
    store.configure_table_for_tests(table)
    mock_env(POLL_RESPONSES_TABLE_NAME="evolvesprouts-poll-responses")

    deleted = store.clear_poll_answers(poll_slug="workshop-food-jun-26")

    assert deleted == 2
    deleted_keys = [
        call.kwargs["Key"]["sk"] for call in batch.delete_item.call_args_list
    ]
    assert "CONTROL" not in deleted_keys
    assert any(sk.startswith("RATELIMIT#") for sk in deleted_keys)
    assert any(sk.startswith("SESSION#") for sk in deleted_keys)
