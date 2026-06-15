from __future__ import annotations

from typing import Any

from app.api import health


def test_check_health_never_returns_internal_exception_text(
    monkeypatch: Any,
) -> None:
    def _fail_db() -> health.HealthCheck:
        return health.HealthCheck(
            name="database",
            healthy=False,
            error="database check failed",
        )

    monkeypatch.setattr(health, "_check_database", _fail_db)
    monkeypatch.setattr(
        health,
        "_check_configuration",
        lambda: health.HealthCheck(name="configuration", healthy=True),
    )

    status = health.check_health()
    body = status.to_dict()

    assert status.healthy is False
    assert body == {
        "healthy": False,
        "version": "unknown",
        "environment": "unknown",
    }
    assert "Traceback" not in str(body)
    assert "SELECT" not in str(body)


def test_lambda_handler_ignores_details_query_param(
    api_gateway_event: Any,
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(
        health,
        "check_health",
        lambda: health.HealthStatus(
            healthy=True,
            checks=[],
            version="1.0.0",
            environment="test",
        ),
    )

    response = health.lambda_handler(
        api_gateway_event(
            method="GET",
            path="/health",
            query_params={"details": "true"},
        ),
        None,
    )
    body = __import__("json").loads(response["body"])
    assert body == {
        "healthy": True,
        "version": "1.0.0",
        "environment": "test",
    }
