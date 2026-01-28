from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

DEFAULT_ADMIN_GROUP = 'admin'
DEFAULT_EVENTS_LIMIT = 100
DEFAULT_FAMILIES_LIMIT = 200


@dataclass(frozen=True)
class AppConfig:
    database_url: Optional[str]
    db_proxy_endpoint: Optional[str]
    db_name: Optional[str]
    db_username: Optional[str]
    db_iam_auth_enabled: bool
    admin_group: str
    cognito_domain: Optional[str]
    cognito_client_id: Optional[str]
    cognito_redirect_uri: Optional[str]
    public_api_key: Optional[str]
    events_limit: int
    families_limit: int


def load_config() -> AppConfig:
    events_limit = _get_int('EVENTS_LIMIT', DEFAULT_EVENTS_LIMIT)
    families_limit = _get_int('FAMILIES_LIMIT', DEFAULT_FAMILIES_LIMIT)
    return AppConfig(
        database_url=os.getenv('DATABASE_URL'),
        db_proxy_endpoint=os.getenv('DB_PROXY_ENDPOINT'),
        db_name=os.getenv('DB_NAME'),
        db_username=os.getenv('DB_USERNAME'),
        db_iam_auth_enabled=_get_bool('DB_IAM_AUTH', True),
        admin_group=os.getenv(
            'COGNITO_ADMIN_GROUP',
            DEFAULT_ADMIN_GROUP,
        ),
        cognito_domain=os.getenv('COGNITO_DOMAIN'),
        cognito_client_id=os.getenv('COGNITO_CLIENT_ID'),
        cognito_redirect_uri=os.getenv('COGNITO_REDIRECT_URI'),
        public_api_key=os.getenv('PUBLIC_API_KEY'),
        events_limit=events_limit,
        families_limit=families_limit,
    )


def _get_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def _get_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized in {'true', '1', 'yes'}:
        return True
    if normalized in {'false', '0', 'no'}:
        return False
    return default
