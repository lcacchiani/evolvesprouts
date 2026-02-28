from __future__ import annotations

import json
from typing import Any

from app.services import secrets as secrets_service


def test_get_secret_json_uses_ttl_cache(monkeypatch: Any) -> None:
    secrets_service.clear_secret_cache()
    calls = {"count": 0}

    class _FakeSecretsClient:
        def get_secret_value(self, SecretId: str) -> dict[str, str]:
            calls["count"] += 1
            return {"SecretString": json.dumps({"secret_arn": SecretId})}

    monotonic_values = iter([100.0, 101.0, 500.0])
    monkeypatch.setattr(
        secrets_service.time,
        "monotonic",
        lambda: next(monotonic_values),
    )
    monkeypatch.setattr(
        secrets_service,
        "get_secretsmanager_client",
        lambda: _FakeSecretsClient(),
    )

    first = secrets_service.get_secret_json("arn:example:secret")
    second = secrets_service.get_secret_json("arn:example:secret")
    third = secrets_service.get_secret_json("arn:example:secret")

    assert first == {"secret_arn": "arn:example:secret"}
    assert second == first
    assert third == first
    assert calls["count"] == 2
