from __future__ import annotations

from typing import Any

import pytest

from app.db.connection import use_iam_auth
from app.exceptions import ConfigurationError
from app.utils import require_env


def test_require_env_returns_stripped_value(monkeypatch: Any) -> None:
    monkeypatch.setenv("EXAMPLE_REQUIRED_ENV", "  configured-value  ")
    assert require_env("EXAMPLE_REQUIRED_ENV") == "configured-value"


def test_require_env_raises_configuration_error_for_missing_env(
    monkeypatch: Any,
) -> None:
    monkeypatch.delenv("EXAMPLE_REQUIRED_ENV", raising=False)
    with pytest.raises(ConfigurationError, match="EXAMPLE_REQUIRED_ENV"):
        require_env("EXAMPLE_REQUIRED_ENV")


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("1", True),
        ("true", True),
        ("yes", True),
        ("0", False),
        ("false", False),
        ("", False),
    ],
)
def test_use_iam_auth_parses_truthy_values(
    monkeypatch: Any,
    raw_value: str,
    expected: bool,
) -> None:
    monkeypatch.setenv("DATABASE_IAM_AUTH", raw_value)
    assert use_iam_auth() is expected
