from __future__ import annotations

from typing import Any

import pytest
from botocore.exceptions import ClientError

from app.utils.retry import run_with_retry


def test_run_with_retry_retries_connection_errors(monkeypatch: Any) -> None:
    monkeypatch.setattr("app.utils.retry.time.sleep", lambda _: None)
    attempts = {"count": 0}

    def flaky_operation() -> str:
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise ConnectionError("temporary network failure")
        return "ok"

    result = run_with_retry(flaky_operation, max_attempts=5, base_delay_seconds=0.01)

    assert result == "ok"
    assert attempts["count"] == 3


def test_run_with_retry_retries_throttling_client_errors(monkeypatch: Any) -> None:
    monkeypatch.setattr("app.utils.retry.time.sleep", lambda _: None)
    attempts = {"count": 0}

    def throttled_operation() -> str:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise ClientError(
                {
                    "Error": {
                        "Code": "ThrottlingException",
                        "Message": "rate exceeded",
                    }
                },
                "ListThings",
            )
        return "ok"

    assert (
        run_with_retry(throttled_operation, max_attempts=3, base_delay_seconds=0.01)
        == "ok"
    )
    assert attempts["count"] == 2


def test_run_with_retry_does_not_retry_non_retryable_errors(monkeypatch: Any) -> None:
    monkeypatch.setattr("app.utils.retry.time.sleep", lambda _: None)

    def non_retryable_operation() -> None:
        raise ValueError("bad input")

    with pytest.raises(ValueError):
        run_with_retry(non_retryable_operation, max_attempts=3, base_delay_seconds=0.01)
