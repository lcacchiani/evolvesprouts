from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

import boto3
import psycopg
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import load_config
from app.errors import internal_error

Base = declarative_base()

_ENGINE = None
_SESSION_FACTORY = None


def _create_engine():
    config = load_config()
    if config.db_iam_auth_enabled:
        return _create_iam_engine(config)
    if not config.database_url:
        raise internal_error('database_not_configured')
    return create_engine(
        _normalize_database_url(config.database_url),
        pool_pre_ping=True,
    )


def _create_iam_engine(config):
    if not config.db_proxy_endpoint or not config.db_name:
        raise internal_error('database_not_configured')
    if not config.db_username:
        raise internal_error('database_not_configured')
    region = _get_region()

    def _connect():
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
    )


def _get_region() -> str:
    region = os.getenv('AWS_REGION') or os.getenv('AWS_DEFAULT_REGION')
    if region:
        return region
    session = boto3.session.Session()
    if session.region_name:
        return session.region_name
    raise internal_error('aws_region_not_configured')


def _generate_token(region: str, host: str, username: str) -> str:
    client = boto3.client('rds', region_name=region)
    return client.generate_db_auth_token(
        DBHostname=host,
        Port=5432,
        DBUsername=username,
    )


def _normalize_database_url(database_url: str) -> str:
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


def get_engine():
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = _create_engine()
    return _ENGINE


def get_session_factory():
    global _SESSION_FACTORY
    if _SESSION_FACTORY is None:
        _SESSION_FACTORY = sessionmaker(bind=get_engine())
    return _SESSION_FACTORY


@contextmanager
def session_scope(commit: bool = False) -> Generator[Session, None, None]:
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
