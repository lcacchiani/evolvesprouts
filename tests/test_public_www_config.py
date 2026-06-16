"""Tests for ``app.config.public_www`` env-var + Secrets Manager fallback."""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.config import public_www as public_www_config
from app.services import secrets as secrets_service


@pytest.fixture(autouse=True)
def _reset_secret_cache() -> None:
    secrets_service.clear_secret_cache()


def test_env_var_takes_precedence_over_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "Env Trading Co")
    monkeypatch.setenv(
        "PUBLIC_WWW_CONFIG_SECRET_ARN",
        "arn:aws:secretsmanager:ap-southeast-1:1:secret:public-www",
    )

    def _fail(_: str) -> dict[str, Any]:  # pragma: no cover - should not be called
        raise AssertionError("secret should not be fetched when env var is set")

    monkeypatch.setattr(public_www_config, "get_secret_json", _fail)

    assert public_www_config.get_public_www("BUSINESS_NAME") == "Env Trading Co"


def test_falls_back_to_secret_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    secret_arn = "arn:aws:secretsmanager:ap-southeast-1:1:secret:public-www-AbCdEf"
    monkeypatch.setenv("PUBLIC_WWW_CONFIG_SECRET_ARN", secret_arn)

    captured: dict[str, str] = {}

    def _fake_get(arn: str) -> dict[str, Any]:
        captured["arn"] = arn
        return {"BUSINESS_NAME": "Secret Trading Co"}

    monkeypatch.setattr(public_www_config, "get_secret_json", _fake_get)

    assert public_www_config.get_public_www("BUSINESS_NAME") == "Secret Trading Co"
    assert captured["arn"] == secret_arn


def test_returns_default_when_neither_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_CONFIG_SECRET_ARN", raising=False)

    assert public_www_config.get_public_www("BUSINESS_NAME") == ""
    assert public_www_config.get_public_www("BUSINESS_NAME", default="X") == "X"


def test_whitespace_env_falls_through_to_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PUBLIC_WWW_BUSINESS_NAME", "   ")
    monkeypatch.setenv(
        "PUBLIC_WWW_CONFIG_SECRET_ARN",
        "arn:aws:secretsmanager:ap-southeast-1:1:secret:public-www-AbCdEf",
    )

    monkeypatch.setattr(
        public_www_config,
        "get_secret_json",
        lambda _arn: {"BUSINESS_NAME": "Secret Trading Co"},
    )

    assert public_www_config.get_public_www("BUSINESS_NAME") == "Secret Trading Co"


def test_secret_fetch_failure_returns_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    monkeypatch.setenv(
        "PUBLIC_WWW_CONFIG_SECRET_ARN",
        "arn:aws:secretsmanager:ap-southeast-1:1:secret:public-www-AbCdEf",
    )

    def _boom(_: str) -> dict[str, Any]:
        raise RuntimeError("network error")

    monkeypatch.setattr(public_www_config, "get_secret_json", _boom)

    assert (
        public_www_config.get_public_www("BUSINESS_NAME", default="fallback")
        == "fallback"
    )


def test_secret_payload_missing_key_returns_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_NAME", raising=False)
    monkeypatch.setenv(
        "PUBLIC_WWW_CONFIG_SECRET_ARN",
        "arn:aws:secretsmanager:ap-southeast-1:1:secret:public-www-AbCdEf",
    )

    monkeypatch.setattr(
        public_www_config,
        "get_secret_json",
        lambda _arn: {"OTHER_KEY": "value"},
    )

    assert public_www_config.get_public_www("BUSINESS_NAME", default="x") == "x"


def test_real_secret_json_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "BASE_URL": "https://www.example.com",
        "BUSINESS_ADDRESS": "Suite 1\r\n123 Main St",
    }
    monkeypatch.delenv("PUBLIC_WWW_BASE_URL", raising=False)
    monkeypatch.delenv("PUBLIC_WWW_BUSINESS_ADDRESS", raising=False)
    secret_arn = "arn:aws:secretsmanager:ap-southeast-1:1:secret:public-www-AbCdEf"
    monkeypatch.setenv("PUBLIC_WWW_CONFIG_SECRET_ARN", secret_arn)

    class _FakeClient:
        def get_secret_value(self, SecretId: str) -> dict[str, str]:
            assert SecretId == secret_arn
            return {"SecretString": json.dumps(payload)}

    monkeypatch.setattr(
        secrets_service, "get_secretsmanager_client", lambda: _FakeClient()
    )

    assert public_www_config.get_public_www("BASE_URL") == "https://www.example.com"
    assert (
        public_www_config.get_public_www("BUSINESS_ADDRESS") == "Suite 1\r\n123 Main St"
    )
