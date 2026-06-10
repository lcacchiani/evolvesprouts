"""Database connection helpers for Lambda runtime."""

from __future__ import annotations

import os
from urllib.parse import quote_plus

from sqlalchemy.engine import make_url

from app.services.aws_clients import get_rds_client
from app.services.secrets import get_secret_json

# Local development/CI hosts exempt from the sslmode=require default.
_LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "::1"}


def ensure_database_url_sslmode(database_url: str) -> str:
    """Default ``sslmode=require`` on non-local URLs that omit it.

    URLs that already carry an explicit ``sslmode`` are returned unchanged,
    as are URLs pointing at local development hosts (allowed exception per
    repository rules). Unparseable values are returned as-is so the driver
    can surface its own error.
    """

    try:
        url = make_url(database_url)
    except Exception:
        return database_url
    if "sslmode" in url.query:
        return database_url
    if (url.host or "").lower() in _LOCAL_DB_HOSTS:
        return database_url
    return url.update_query_dict({"sslmode": "require"}).render_as_string(
        hide_password=False
    )


def get_database_url() -> str:
    """Resolve the database URL from env or Secrets Manager."""

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return ensure_database_url_sslmode(database_url)

    secret_arn = os.getenv("DATABASE_SECRET_ARN")
    if not secret_arn:
        raise RuntimeError("DATABASE_URL or DATABASE_SECRET_ARN is required")

    secret = get_secret_json(secret_arn)
    username = (
        os.getenv("DATABASE_USERNAME") or secret.get("username") or secret.get("user")
    )
    password = secret.get("password")
    host = os.getenv("DATABASE_HOST") or secret.get("host")
    if use_iam_auth():
        host = os.getenv("DATABASE_PROXY_ENDPOINT") or host
    port = os.getenv("DATABASE_PORT") or secret.get("port") or 5432
    database = (
        secret.get("dbname")
        or secret.get("database")
        or os.getenv("DATABASE_NAME")
        or "evolvesprouts"
    )

    if not username or not host:
        raise RuntimeError("Secret is missing database connection fields")

    use_iam = use_iam_auth()
    if not use_iam and not password:
        raise RuntimeError("Password is required for non-IAM authentication")

    if use_iam:
        token = _generate_iam_token(host, int(port), str(username))
        return (
            "postgresql+psycopg://"
            f"{quote_plus(str(username))}:{quote_plus(token)}"
            f"@{host}:{port}/{database}?sslmode=require"
        )

    return (
        "postgresql+psycopg://"
        f"{quote_plus(str(username))}:{quote_plus(str(password))}"
        f"@{host}:{port}/{database}?sslmode=require"
    )


def use_iam_auth() -> bool:
    """Return True if IAM auth is enabled."""

    return str(os.getenv("DATABASE_IAM_AUTH", "")).lower() in {"1", "true", "yes"}


def _generate_iam_token(host: str, port: int, username: str) -> str:
    """Generate an IAM auth token for RDS Proxy."""

    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
    if not region:
        raise RuntimeError("AWS_REGION is required for IAM auth")

    client = get_rds_client(region_name=region)
    return client.generate_db_auth_token(
        DBHostname=host, Port=port, DBUsername=username
    )
