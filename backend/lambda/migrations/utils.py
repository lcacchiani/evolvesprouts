"""Utility helpers for migrations Lambda."""

from __future__ import annotations

import re
from typing import Any

import psycopg
from sqlalchemy.engine import make_url

from app.utils.logging import get_logger
from app.utils.retry import run_with_retry

logger = get_logger(__name__)


def _run_with_retry(func: Any, *args: Any) -> None:
    """Retry migration operations to wait for DB readiness."""
    func_name = getattr(func, "__name__", str(func))
    try:
        run_with_retry(
            func,
            *args,
            max_attempts=10,
            base_delay_seconds=5.0,
            max_delay_seconds=30.0,
            should_retry=lambda _exc: True,  # pragma: no cover - operational resilience
            logger=logger,
            operation_name=func_name,
        )
    except Exception as exc:
        # Guard against leaking credentials from connection/DSN error strings.
        safe_message = _sanitize_error_message(str(exc))
        if safe_message == str(exc):
            raise
        raise RuntimeError(safe_message) from exc

    logger.info(f"Operation {func_name} completed successfully")


def _sanitize_error_message(msg: str) -> str:
    """Remove potential credentials from migration error messages."""
    msg = re.sub(r"://[^:]+:[^@]+@", "://***:***@", msg)
    msg = re.sub(r"password=[A-Za-z0-9+/=]{20,}", "password=***REDACTED***", msg)
    return msg


def _escape_config(value: str) -> str:
    """Escape percent signs for configparser interpolation."""
    return value.replace("%", "%%")


def _psycopg_connect(database_url: str) -> psycopg.Connection:
    """Connect using keyword args to avoid DSN parsing issues."""
    try:
        url = make_url(database_url)
    except Exception:
        url = make_url(f"postgresql://{database_url}")

    connect_kwargs: dict[str, Any] = {
        "user": url.username,
        "password": url.password,
        "host": url.host,
        "port": url.port,
        "dbname": url.database,
    }
    sslmode = url.query.get("sslmode")
    if sslmode:
        connect_kwargs["sslmode"] = sslmode

    return psycopg.connect(
        **{key: value for key, value in connect_kwargs.items() if value is not None}
    )


def _truthy(value: Any) -> bool:
    """Return True for common truthy string values."""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "y"}
