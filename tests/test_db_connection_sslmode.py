"""Tests for sslmode enforcement on database URLs."""

from __future__ import annotations

from typing import Any

from app.db.connection import ensure_database_url_sslmode, get_database_url


def test_appends_sslmode_require_for_remote_host() -> None:
    url = "postgresql+psycopg://user:pass@db.example.com:5432/app"
    assert (
        ensure_database_url_sslmode(url)
        == "postgresql+psycopg://user:pass@db.example.com:5432/app?sslmode=require"
    )


def test_preserves_explicit_sslmode() -> None:
    url = "postgresql+psycopg://user:pass@db.example.com:5432/app?sslmode=verify-full"
    assert ensure_database_url_sslmode(url) == url


def test_preserves_explicit_sslmode_disable() -> None:
    url = "postgresql+psycopg://user:pass@db.example.com:5432/app?sslmode=disable"
    assert ensure_database_url_sslmode(url) == url


def test_localhost_exempt_from_ssl_default() -> None:
    url = "postgresql+psycopg://test:test@localhost:5432/evolvesprouts_test"
    assert ensure_database_url_sslmode(url) == url


def test_loopback_ip_exempt_from_ssl_default() -> None:
    url = "postgresql+psycopg://test:test@127.0.0.1:5432/evolvesprouts_test"
    assert ensure_database_url_sslmode(url) == url


def test_keeps_other_query_params_and_password() -> None:
    url = "postgresql+psycopg://user:p%40ss@db.example.com/app?connect_timeout=5"
    result = ensure_database_url_sslmode(url)
    assert "connect_timeout=5" in result
    assert "sslmode=require" in result
    assert "p%40ss" in result


def test_unparseable_url_returned_unchanged() -> None:
    assert ensure_database_url_sslmode("not a url") == "not a url"


def test_get_database_url_enforces_sslmode_on_env_url(monkeypatch: Any) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://user:pass@db.example.com:5432/app"
    )
    assert get_database_url().endswith("?sslmode=require")


def test_get_database_url_keeps_local_env_url(monkeypatch: Any) -> None:
    url = "postgresql+psycopg://test:test@localhost:5432/evolvesprouts_test"
    monkeypatch.setenv("DATABASE_URL", url)
    assert get_database_url() == url
