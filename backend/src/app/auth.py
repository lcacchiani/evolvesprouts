"""Authentication and authorization utilities.

This module provides functions for verifying JWT claims from API Gateway
authorizers and enforcing access control (admin group membership, API keys).
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.config import load_config
from app.errors import forbidden, unauthorized


def require_admin(event: Dict[str, Any]) -> Dict[str, Any]:
    """Verify the request is from an admin user.

    Extracts JWT claims from the API Gateway authorizer context and
    verifies the user belongs to the configured admin group.

    Args:
        event: API Gateway Lambda proxy event with JWT authorizer.

    Returns:
        JWT claims dictionary for the authenticated user.

    Raises:
        ApiError: If user is not authenticated (401 unauthorized).
        ApiError: If user is not in admin group (403 forbidden).
    """
    claims = _get_claims(event)
    config = load_config()
    groups = _parse_groups(claims)
    if config.admin_group not in groups:
        raise forbidden('admin_required')
    return claims


def require_public_api_key(event: Dict[str, Any]) -> None:
    """Verify the request contains a valid API key (if configured).

    Checks the X-Api-Key header against the configured public API key.
    If no API key is configured, this check is skipped (open access).

    Args:
        event: API Gateway Lambda proxy event.

    Raises:
        ApiError: If API key is required but missing/invalid (401 unauthorized).
    """
    config = load_config()
    if not config.public_api_key:
        # No API key configured, skip validation
        return
    headers = _normalize_headers(event.get('headers') or {})
    provided = headers.get('x-api-key')
    if provided != config.public_api_key:
        raise unauthorized('invalid_api_key')


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract user ID (sub claim) from JWT.

    Args:
        event: API Gateway Lambda proxy event with JWT authorizer.

    Returns:
        User ID from the 'sub' claim.

    Raises:
        ApiError: If user is not authenticated (401 unauthorized).
    """
    claims = _get_claims(event)
    user_id = claims.get('sub')
    if not user_id:
        raise unauthorized('missing_user_id')
    return str(user_id)


def get_user_email(event: Dict[str, Any]) -> str:
    """Extract user email from JWT claims.

    Args:
        event: API Gateway Lambda proxy event with JWT authorizer.

    Returns:
        User email address.

    Raises:
        ApiError: If user is not authenticated (401 unauthorized).
    """
    claims = _get_claims(event)
    email = claims.get('email')
    if not email:
        raise unauthorized('missing_email')
    return str(email)


def _get_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    """Extract JWT claims from API Gateway authorizer context.

    Supports API Gateway HTTP API v2.0 JWT authorizer format.

    Args:
        event: API Gateway Lambda proxy event.

    Returns:
        JWT claims dictionary.

    Raises:
        ApiError: If claims are missing or invalid (401 unauthorized).
    """
    request_context = event.get('requestContext') or {}
    authorizer = request_context.get('authorizer') or {}
    jwt_context = authorizer.get('jwt') or {}
    claims = jwt_context.get('claims')
    if not isinstance(claims, dict):
        raise unauthorized('missing_claims')
    return claims


def _parse_groups(claims: Dict[str, Any]) -> List[str]:
    """Parse Cognito groups from JWT claims.

    Handles both list and comma-separated string formats.

    Args:
        claims: JWT claims dictionary.

    Returns:
        List of group names (empty if no groups).
    """
    raw_groups = claims.get('cognito:groups')
    if raw_groups is None:
        return []
    if isinstance(raw_groups, list):
        return [str(value).strip() for value in raw_groups if value]
    if isinstance(raw_groups, str):
        return [item.strip() for item in raw_groups.split(',') if item]
    return []


def _normalize_headers(headers: Dict[str, Any]) -> Dict[str, str]:
    """Normalize HTTP headers to lowercase keys.

    API Gateway may pass headers with varying case. This normalizes
    all keys to lowercase for consistent lookup.

    Args:
        headers: Raw headers dictionary from API Gateway event.

    Returns:
        Headers dictionary with lowercase keys.
    """
    normalized: Dict[str, str] = {}
    for key, value in headers.items():
        if not isinstance(key, str):
            continue
        if not isinstance(value, str):
            continue
        normalized[key.lower()] = value
    return normalized
