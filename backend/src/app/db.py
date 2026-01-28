"""Database connection and session management.

This module provides SQLAlchemy engine and session configuration,
supporting both standard password auth and AWS IAM authentication
via RDS Proxy.

Connection pooling is configured for Lambda environments with:
- pool_pre_ping: Validates connections before use
- Lambda-optimized pool settings when using IAM auth
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Any, Generator, Optional

import boto3
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

# Lambda-optimized pool settings
LAMBDA_POOL_SIZE = 1
LAMBDA_MAX_OVERFLOW = 0


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

    Uses a custom connection creator that generates fresh IAM auth
    tokens for each connection. Tokens are valid for 15 minutes.

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
    logger.info(
        'Configuring IAM auth for RDS Proxy: endpoint=%s db=%s user=%s',
        config.db_proxy_endpoint,
        config.db_name,
        config.db_username,
    )

    def _connect() -> Any:
        """Create a new database connection with fresh IAM token."""
        token = _generate_token(
            region,
            config.db_proxy_endpoint,
            config.db_username,
        )
        return psycopg.connect(
            host=config.db_proxy_endpoint,
            user=config.db_username,
            password=token,
            dbname=config.db_name,
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


def _get_region() -> str:
    """Get AWS region from environment or boto3 session.

    Returns:
        AWS region string.

    Raises:
        ApiError: If region cannot be determined (500 internal_error).
    """
    region = os.getenv('AWS_REGION') or os.getenv('AWS_DEFAULT_REGION')
    if region:
        return region
    session = boto3.session.Session()
    if session.region_name:
        return session.region_name
    raise internal_error('aws_region_not_configured')


def _generate_token(region: str, host: str, username: str) -> str:
    """Generate IAM auth token for RDS/RDS Proxy connection.

    Args:
        region: AWS region.
        host: RDS Proxy endpoint hostname.
        username: Database username.

    Returns:
        IAM auth token valid for 15 minutes.
    """
    client = boto3.client('rds', region_name=region)
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
    """Reset engine and session factory. Useful for testing."""
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None


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
