from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

import pytest


def _load_migration_utils_module() -> Any:
    module_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "lambda"
        / "migrations"
        / "utils.py"
    )
    spec = importlib.util.spec_from_file_location(
        "test_migration_utils_module",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_sanitize_error_message_redacts_dsn_credentials() -> None:
    migration_utils = _load_migration_utils_module()
    raw = "could not connect to postgresql://user:secret-pass@db.example.com:5432/app"
    sanitized = migration_utils._sanitize_error_message(raw)
    assert "secret-pass" not in sanitized
    assert "://***:***@" in sanitized


def test_run_with_retry_wraps_sensitive_messages(monkeypatch: Any) -> None:
    migration_utils = _load_migration_utils_module()

    def _raise_sensitive_error(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("password=abcd1234abcd1234abcd1234abcd1234")

    monkeypatch.setattr(migration_utils, "run_with_retry", _raise_sensitive_error)

    with pytest.raises(RuntimeError, match=r"password=\*\*\*REDACTED\*\*\*"):
        migration_utils._run_with_retry(lambda: None)
