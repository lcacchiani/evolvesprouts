import base64
import json
from typing import Any, Dict, Optional

from app.errors import ApiError, bad_request
from app.pagination import decode_cursor

DEFAULT_HEADERS = {
    'content-type': 'application/json',
}


def json_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': DEFAULT_HEADERS,
        'body': json.dumps(body),
    }


def error_response(error: ApiError) -> Dict[str, Any]:
    return json_response(error.status_code, {'error': error.message})


def parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
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
    params = event.get('queryStringParameters') or {}
    value = params.get(name)
    if value is None:
        return default
    return value


def parse_cursor(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    raw_cursor = get_query_param(event, 'cursor')
    return decode_cursor(raw_cursor)


def parse_limit(
    event: Dict[str, Any],
    default: int,
    max_limit: int = 500,
) -> int:
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
