"""HTTP request/response utilities for Lambda handlers.

This module provides helper functions for parsing API Gateway events
and building HTTP responses in the Lambda proxy integration format.

Performance notes:
- Headers dict is frozen (never modified) to allow safe reuse
- JSON encoding uses separators to minimize output size
- Base64 decoding is lazy (only when isBase64Encoded is True)
"""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, Final, Optional

from app.errors import ApiError, bad_request
from app.pagination import decode_cursor

# Frozen default headers (safe to reuse across responses)
DEFAULT_HEADERS: Final[Dict[str, str]] = {
    'content-type': 'application/json',
}

# JSON encoder settings for compact output
_JSON_SEPARATORS: Final = (',', ':')


def json_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a JSON HTTP response for API Gateway.

    Args:
        status_code: HTTP status code (e.g., 200, 400, 500).
        body: Response body dictionary to JSON-serialize.

    Returns:
        API Gateway response dictionary with statusCode, headers, and body.
    """
    return {
        'statusCode': status_code,
        'headers': DEFAULT_HEADERS,
        'body': json.dumps(body, separators=_JSON_SEPARATORS),
    }


def error_response(error: ApiError) -> Dict[str, Any]:
    """Create an error HTTP response from an ApiError.

    Args:
        error: ApiError instance with status_code and message.

    Returns:
        API Gateway response dictionary with error details.
    """
    return json_response(error.status_code, {'error': error.message})


def parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse JSON body from API Gateway event.

    Handles both raw and base64-encoded bodies (for binary content types).

    Args:
        event: API Gateway Lambda proxy event.

    Returns:
        Parsed JSON body as dictionary, or empty dict if no body.

    Raises:
        ApiError: If body is not valid JSON (400 bad_request).
    """
    raw_body = event.get('body')
    if not raw_body:
        return {}
    if event.get('isBase64Encoded'):
        raw_body = base64.b64decode(raw_body).decode('utf-8')
    try:
        parsed = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise bad_request('invalid_json') from exc
    if isinstance(parsed, dict):
        return parsed
    raise bad_request('invalid_json')


def get_query_param(
    event: Dict[str, Any],
    name: str,
    default: Optional[str] = None,
) -> Optional[str]:
    """Get a query string parameter from API Gateway event.

    Args:
        event: API Gateway Lambda proxy event.
        name: Query parameter name.
        default: Default value if parameter is not present.

    Returns:
        Parameter value as string, or default if not present.
    """
    params = event.get('queryStringParameters') or {}
    value = params.get(name)
    if value is None:
        return default
    return value


def get_path_param(event: Dict[str, Any], name: str) -> Optional[str]:
    """Get a path parameter from API Gateway event.

    Args:
        event: API Gateway Lambda proxy event.
        name: Path parameter name.

    Returns:
        Parameter value as string, or None if not present.
    """
    params = event.get('pathParameters') or {}
    return params.get(name)


def parse_cursor(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse pagination cursor from query parameters.

    Args:
        event: API Gateway Lambda proxy event.

    Returns:
        Decoded cursor dictionary, or None if no cursor provided.

    Raises:
        ApiError: If cursor is malformed (400 bad_request).
    """
    raw_cursor = get_query_param(event, 'cursor')
    return decode_cursor(raw_cursor)


def parse_limit(
    event: Dict[str, Any],
    default: int,
    max_limit: int = 500,
) -> int:
    """Parse pagination limit from query parameters.

    Args:
        event: API Gateway Lambda proxy event.
        default: Default limit if not specified in request.
        max_limit: Maximum allowed limit (caps the requested value).

    Returns:
        Parsed limit value, capped at max_limit.

    Raises:
        ApiError: If limit is not a positive integer (400 bad_request).
    """
    raw_limit = get_query_param(event, 'limit')
    if raw_limit is None:
        return default
    try:
        value = int(raw_limit)
    except ValueError as exc:
        raise bad_request('invalid_limit') from exc
    if value <= 0:
        raise bad_request('invalid_limit')
    return min(value, max_limit)


def parse_int_param(
    event: Dict[str, Any],
    name: str,
    default: Optional[int] = None,
) -> Optional[int]:
    """Parse an integer query parameter.

    Args:
        event: API Gateway Lambda proxy event.
        name: Query parameter name.
        default: Default value if parameter is not present.

    Returns:
        Parsed integer value, or default if not present.

    Raises:
        ApiError: If value is not a valid integer (400 bad_request).
    """
    raw_value = get_query_param(event, name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError as exc:
        raise bad_request(f'invalid_{name}') from exc
