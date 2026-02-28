"""Shared retry helpers for transient-operation resilience."""

from __future__ import annotations

import secrets
import time
from typing import Any, Callable, TypeVar

from botocore.exceptions import ClientError

RETRYABLE_AWS_ERROR_CODES = {
    "Throttling",
    "ThrottlingException",
    "TooManyRequestsException",
    "RequestLimitExceeded",
    "ServiceUnavailable",
    "ServiceUnavailableException",
    "InternalFailure",
    "InternalError",
    "RequestTimeout",
    "RequestTimeoutException",
    "PriorRequestNotComplete",
    "SlowDown",
}

T = TypeVar("T")


def _is_retryable_exception(
    exc: Exception,
    *,
    retryable_error_codes: set[str],
) -> bool:
    if isinstance(exc, (ConnectionError, TimeoutError)):
        return True

    if isinstance(exc, ClientError):
        error_code = (
            exc.response.get("Error", {}).get("Code")
            if isinstance(exc.response, dict)
            else None
        )
        return bool(error_code in retryable_error_codes)

    return False


def run_with_retry(
    operation: Callable[..., T],
    *args: Any,
    max_attempts: int = 5,
    base_delay_seconds: float = 1.0,
    max_delay_seconds: float = 30.0,
    should_retry: Callable[[Exception], bool] | None = None,
    retryable_error_codes: set[str] | None = None,
    logger: Any | None = None,
    operation_name: str | None = None,
    **kwargs: Any,
) -> T:
    """Run an operation with exponential backoff and jitter."""
    if max_attempts < 1:
        raise ValueError("max_attempts must be >= 1")
    if base_delay_seconds <= 0:
        raise ValueError("base_delay_seconds must be > 0")

    resolved_codes = retryable_error_codes or RETRYABLE_AWS_ERROR_CODES
    retry_predicate = should_retry or (
        lambda exc: _is_retryable_exception(exc, retryable_error_codes=resolved_codes)
    )
    name = operation_name or getattr(operation, "__name__", "operation")
    delay_seconds = base_delay_seconds

    for attempt in range(1, max_attempts + 1):
        try:
            return operation(*args, **kwargs)
        except Exception as exc:
            if attempt >= max_attempts or not retry_predicate(exc):
                raise

            jitter_factor = 0.75 + (secrets.randbelow(1000) / 1000.0) * 0.5
            sleep_seconds = min(max_delay_seconds, delay_seconds * jitter_factor)
            if logger is not None:
                logger.warning(
                    f"Retryable failure for {name}; retrying",
                    extra={
                        "operation": name,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                        "error_type": type(exc).__name__,
                        "sleep_seconds": round(sleep_seconds, 3),
                    },
                )
            time.sleep(sleep_seconds)
            delay_seconds = min(max_delay_seconds, delay_seconds * 2)

    raise RuntimeError(f"Failed to execute retry operation: {name}")
