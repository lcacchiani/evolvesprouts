from typing import Any, Dict, List

from app.config import load_config
from app.errors import forbidden, unauthorized


def require_admin(event: Dict[str, Any]) -> Dict[str, Any]:
    claims = _get_claims(event)
    config = load_config()
    groups = _parse_groups(claims)
    if config.admin_group not in groups:
        raise forbidden('admin_required')
    return claims


def require_public_api_key(event: Dict[str, Any]) -> None:
    config = load_config()
    if not config.public_api_key:
        return
    headers = _normalize_headers(event.get('headers') or {})
    provided = headers.get('x-api-key')
    if provided != config.public_api_key:
        raise unauthorized('invalid_api_key')


def _get_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    request_context = event.get('requestContext') or {}
    authorizer = request_context.get('authorizer') or {}
    jwt_context = authorizer.get('jwt') or {}
    claims = jwt_context.get('claims')
    if not isinstance(claims, dict):
        raise unauthorized('missing_claims')
    return claims


def _parse_groups(claims: Dict[str, Any]) -> List[str]:
    raw_groups = claims.get('cognito:groups')
    if raw_groups is None:
        return []
    if isinstance(raw_groups, list):
        return [str(value).strip() for value in raw_groups if value]
    if isinstance(raw_groups, str):
        return [item.strip() for item in raw_groups.split(',') if item]
    return []


def _normalize_headers(headers: Dict[str, Any]) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    for key, value in headers.items():
        if not isinstance(key, str):
            continue
        if not isinstance(value, str):
            continue
        normalized[key.lower()] = value
    return normalized
