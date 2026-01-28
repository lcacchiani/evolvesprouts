"""Database connection and session management.

This module provides SQLAlchemy engine and session configuration,
supporting both standard password auth and AWS IAM authentication
via RDS Proxy.

Connection pooling is configured for Lambda environments with:
- pool_pre_ping: Validates connections before use
- Lambda-optimized pool settings when using IAM auth

Performance optimizations:
- Cached boto3 RDS client (reused across connections)
- Cached IAM auth tokens with TTL (tokens valid for 15 min, cached for 10 min)
- Cached AWS region lookup
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Generator, Optional

# Note: boto3 is imported lazily in _get_region() and _get_rds_client()
# to reduce cold start time when not using IAM auth
import psycopg
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import AppConfig, load_config
from app.errors import internal_error

logger = logging.getLogger(__name__)

Base = declarative_base()

# Module-level singletons (cached for Lambda warm starts)
_ENGINE: Optional[Engine] = None
_SESSION_FACTORY: Optional[sessionmaker] = None

# Cached AWS resources (expensive to create)
_RDS_CLIENT: Optional[Any] = None
_CACHED_REGION: Optional[str] = None

# Lambda-optimized pool settings
LAMBDA_POOL_SIZE = 1
LAMBDA_MAX_OVERFLOW = 0

# IAM token cache settings (tokens valid 15 min, refresh at 10 min)
_TOKEN_CACHE_TTL_SECONDS = 600  # 10 minutes


@dataclass
class _CachedToken:
    """Cached IAM auth token with expiry tracking."""

    __slots__ = ('token', 'expires_at', 'cache_key')

    token: str
    expires_at: float
    cache_key: str


# Token cache (keyed by host+username)
_TOKEN_CACHE: Optional[_CachedToken] = None


def _create_engine() -> Engine:
    """Create SQLAlchemy engine based on configuration.

    Returns:
        Configured SQLAlchemy Engine instance.

    Raises:
        ApiError: If database is not configured (500 internal_error).
    """
    config = load_config()
    if config.db_iam_auth_enabled:
        return _create_iam_engine(config)
    if not config.database_url:
        raise internal_error('database_not_configured')
    return create_engine(
        _normalize_database_url(config.database_url),
        pool_pre_ping=True,
    )


def _create_iam_engine(config: AppConfig) -> Engine:
    """Create engine with IAM authentication for RDS Proxy.

    Uses a custom connection creator with cached IAM auth tokens.
    Tokens are cached for 10 minutes (they're valid for 15 minutes).

    Args:
        config: Application configuration with RDS Proxy settings.

    Returns:
        Configured SQLAlchemy Engine instance.

    Raises:
        ApiError: If database settings are missing (500 internal_error).
    """
    if not config.db_proxy_endpoint or not config.db_name:
        raise internal_error('database_not_configured')
    if not config.db_username:
        raise internal_error('database_not_configured')

    region = _get_region()
    if logger.isEnabledFor(logging.INFO):
        logger.info(
            'Configuring IAM auth for RDS Proxy: endpoint=%s db=%s user=%s',
            config.db_proxy_endpoint,
            config.db_name,
            config.db_username,
        )

    # Capture config values for closure (avoids repeated config lookups)
    host = config.db_proxy_endpoint
    username = config.db_username
    dbname = config.db_name

    def _connect() -> Any:
        """Create a new database connection with cached IAM token."""
        token = _get_cached_token(region, host, username)
        return psycopg.connect(
            host=host,
            user=username,
            password=token,
            dbname=dbname,
            port=5432,
            sslmode='require',
        )

    return create_engine(
        'postgresql+psycopg://',
        creator=_connect,
        pool_pre_ping=True,
        pool_size=LAMBDA_POOL_SIZE,
        max_overflow=LAMBDA_MAX_OVERFLOW,
    )


def _get_cached_token(region: str, host: str, username: str) -> str:
    """Get IAM auth token, using cache if valid.

    Tokens are cached for 10 minutes to reduce AWS API calls.
    IAM tokens are valid for 15 minutes, so 10-minute cache is safe.

    Args:
        region: AWS region.
        host: RDS Proxy endpoint hostname.
        username: Database username.

    Returns:
        IAM auth token (from cache or freshly generated).
    """
    global _TOKEN_CACHE

    cache_key = f'{host}:{username}'
    now = time.monotonic()

    # Check if cached token is still valid
    if (
        _TOKEN_CACHE is not None
        and _TOKEN_CACHE.cache_key == cache_key
        and _TOKEN_CACHE.expires_at > now
    ):
        return _TOKEN_CACHE.token

    # Generate new token
    token = _generate_token(region, host, username)
    _TOKEN_CACHE = _CachedToken(
        token=token,
        expires_at=now + _TOKEN_CACHE_TTL_SECONDS,
        cache_key=cache_key,
    )
    return token


def _get_region() -> str:
    """Get AWS region from environment or boto3 session (cached).

    Returns:
        AWS region string.

    Raises:
        ApiError: If region cannot be determined (500 internal_error).
    """
    global _CACHED_REGION

    if _CACHED_REGION is not None:
        return _CACHED_REGION

    region = os.getenv('AWS_REGION') or os.getenv('AWS_DEFAULT_REGION')
    if region:
        _CACHED_REGION = region
        return region

    # Lazy import boto3 only when needed for region discovery
    import boto3

    session = boto3.session.Session()
    if session.region_name:
        _CACHED_REGION = session.region_name
        return session.region_name

    raise internal_error('aws_region_not_configured')


def _get_rds_client(region: str) -> Any:
    """Get cached boto3 RDS client.

    boto3 clients are thread-safe and can be reused across invocations.

    Args:
        region: AWS region for the client.

    Returns:
        boto3 RDS client instance.
    """
    global _RDS_CLIENT

    if _RDS_CLIENT is None:
        # Lazy import boto3 only when creating client
        import boto3

        _RDS_CLIENT = boto3.client('rds', region_name=region)

    return _RDS_CLIENT


def _generate_token(region: str, host: str, username: str) -> str:
    """Generate IAM auth token for RDS/RDS Proxy connection.

    Uses cached boto3 client to avoid client creation overhead.

    Args:
        region: AWS region.
        host: RDS Proxy endpoint hostname.
        username: Database username.

    Returns:
        IAM auth token valid for 15 minutes.
    """
    client = _get_rds_client(region)
    return client.generate_db_auth_token(
        DBHostname=host,
        Port=5432,
        DBUsername=username,
    )


def _normalize_database_url(database_url: str) -> str:
    """Normalize database URL to use psycopg3 dialect.

    Converts legacy postgresql:// or postgresql+psycopg2:// URLs
    to the psycopg3 format (postgresql+psycopg://).

    Args:
        database_url: Original database URL.

    Returns:
        Normalized URL with psycopg3 dialect.
    """
    if database_url.startswith('postgresql+psycopg2://'):
        return database_url.replace(
            'postgresql+psycopg2://',
            'postgresql+psycopg://',
            1,
        )
    if database_url.startswith('postgresql://'):
        return database_url.replace(
            'postgresql://',
            'postgresql+psycopg://',
            1,
        )
    return database_url


def get_engine() -> Engine:
    """Get the SQLAlchemy engine (singleton, cached for Lambda warm starts).

    Returns:
        SQLAlchemy Engine instance.
    """
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = _create_engine()
    return _ENGINE


def get_session_factory() -> sessionmaker:
    """Get the session factory (singleton, cached for Lambda warm starts).

    Returns:
        SQLAlchemy sessionmaker instance.
    """
    global _SESSION_FACTORY
    if _SESSION_FACTORY is None:
        _SESSION_FACTORY = sessionmaker(bind=get_engine())
    return _SESSION_FACTORY


def reset_engine() -> None:
    """Reset engine, session factory, and all caches. Useful for testing."""
    global _ENGINE, _SESSION_FACTORY, _RDS_CLIENT, _CACHED_REGION, _TOKEN_CACHE
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None
    _RDS_CLIENT = None
    _CACHED_REGION = None
    _TOKEN_CACHE = None


@contextmanager
def session_scope(*, commit: bool = False) -> Generator[Session, None, None]:
    """Context manager for database sessions with automatic cleanup.

    Provides a transactional scope around database operations. The
    session is automatically rolled back on exceptions and always
    closed when the context exits.

    Args:
        commit: If True, commit the transaction on successful exit.
                If False (default), changes are not persisted.

    Yields:
        SQLAlchemy Session instance.

    Raises:
        Any exception raised within the context (after rollback).

    Example:
        # Read-only query
        with session_scope() as session:
            users = session.query(User).all()

        # Write operation
        with session_scope(commit=True) as session:
            session.add(User(name='Alice'))
    """
    session = get_session_factory()()
    try:
        yield session
        if commit:
            session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
