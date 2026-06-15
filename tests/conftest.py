"""Pytest configuration for backend tests."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

_TESTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _TESTS_DIR.parent
_BACKEND_SRC = _REPO_ROOT / "backend" / "src"
for _path in (_REPO_ROOT, _BACKEND_SRC):
    _path_str = str(_path)
    if _path_str not in sys.path:
        sys.path.insert(0, _path_str)

import pytest  # noqa: E402

from tests.helpers.db import database_url, libpq_conn_url  # noqa: E402


__all__ = ["database_url", "libpq_conn_url"]


@pytest.fixture
def test_database_url() -> str:
    """Resolved ``TEST_DATABASE_URL`` or skip when unset."""
    url = database_url()
    if url is None:
        pytest.skip("TEST_DATABASE_URL not set")
    return url


@pytest.fixture
def api_gateway_event() -> Any:
    """Factory for API Gateway Lambda event dictionaries."""

    def _make(
        *,
        method: str = "GET",
        path: str = "/",
        body: str | None = None,
        headers: dict[str, str] | None = None,
        query_params: dict[str, str] | None = None,
        multi_query_params: dict[str, list[str]] | None = None,
        authorizer_context: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        return {
            "httpMethod": method,
            "path": path,
            "headers": headers or {},
            "queryStringParameters": query_params,
            "multiValueQueryStringParameters": multi_query_params,
            "body": body,
            "isBase64Encoded": False,
            "requestContext": {
                "requestId": "test-request-id",
                "authorizer": authorizer_context or {},
            },
        }

    return _make


@pytest.fixture
def admin_identity() -> dict[str, str]:
    """Authorizer context for an admin user."""
    return {
        "userSub": "test-admin-sub-12345",
        "email": "admin@example.com",
        "groups": "admin",
        "organizationIds": "org-1",
    }


@pytest.fixture
def mock_env(monkeypatch: pytest.MonkeyPatch) -> Any:
    """Helper fixture to set multiple environment variables."""

    def _set(**kwargs: Any) -> None:
        for key, value in kwargs.items():
            monkeypatch.setenv(key, str(value))

    return _set


@pytest.fixture
def cloudfront_dummy_signer() -> Any:
    """Reusable CloudFront signer double for signing tests."""

    class _DummySigner:
        def __init__(self) -> None:
            self.resource_url: str | None = None
            self.date_less_than: Any | None = None

        def generate_presigned_url(self, resource_url: str, date_less_than: Any) -> str:
            self.resource_url = resource_url
            self.date_less_than = date_less_than
            return "https://signed.example.com/download"

    return _DummySigner()


@pytest.fixture
def cloudfront_fake_private_key() -> Any:
    """Reusable private key double for CloudFront signing tests."""

    class _FakePrivateKey:
        def __init__(self) -> None:
            self.message: bytes | None = None
            self.padding_name: str | None = None
            self.algorithm_name: str | None = None

        def sign(self, message: bytes, applied_padding: Any, algorithm: Any) -> bytes:
            self.message = message
            self.padding_name = type(applied_padding).__name__
            self.algorithm_name = type(algorithm).__name__
            return b"signature"

    return _FakePrivateKey()


@pytest.fixture
def turnstile_http_success_response() -> Any:
    """Reusable success response mock for Turnstile verification."""

    def _invoke(**_: Any) -> dict[str, Any]:
        return {"status": 200, "body": '{"success": true}'}

    return _invoke


@pytest.fixture
def turnstile_http_proxy_error() -> Any:
    """Reusable proxy-error mock for Turnstile verification."""
    from app.services.aws_proxy import AwsProxyError

    def _invoke(**_: Any) -> dict[str, Any]:
        raise AwsProxyError("ProxyError", "blocked")

    return _invoke
