import base64
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from app.errors import bad_request


def decode_cursor(raw_cursor: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw_cursor:
        return None
    try:
        padded = _pad_base64(raw_cursor)
        decoded = base64.urlsafe_b64decode(padded.encode('utf-8'))
        payload = json.loads(decoded.decode('utf-8'))
    except (ValueError, json.JSONDecodeError) as exc:
        raise bad_request('invalid_cursor') from exc
    if not isinstance(payload, dict):
        raise bad_request('invalid_cursor')
    return payload


def encode_cursor(payload: Dict[str, Any]) -> str:
    encoded = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    return base64.urlsafe_b64encode(encoded).decode('utf-8').rstrip('=')


def parse_cursor_datetime(value: Optional[str]) -> datetime:
    if not value:
        raise bad_request('invalid_cursor')
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise bad_request('invalid_cursor') from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def parse_cursor_uuid(value: Optional[str]) -> UUID:
    if not value:
        raise bad_request('invalid_cursor')
    try:
        return UUID(value)
    except ValueError as exc:
        raise bad_request('invalid_cursor') from exc


def _pad_base64(value: str) -> str:
    padding = '=' * (-len(value) % 4)
    return f'{value}{padding}'
