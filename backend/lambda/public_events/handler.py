"""Public events Lambda handler."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict

# Bootstrap: Add src directory to Python path
_src_dir = str(Path(__file__).resolve().parents[2] / 'src')
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from app.auth import require_public_api_key
from app.config import load_config
from app.handler import lambda_handler, success_response
from app.http import parse_cursor, parse_limit
from app.services.events_service import get_public_events


@lambda_handler()
def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """List public events with pagination.

    Optionally requires API key via X-Api-Key header.

    Query Parameters:
        limit: Maximum results to return (default from config).
        cursor: Pagination cursor for next page.

    Returns:
        JSON response with events array and next_cursor.
    """
    require_public_api_key(event)
    config = load_config()
    limit = parse_limit(event, config.events_limit)
    cursor = parse_cursor(event)
    events, next_cursor = get_public_events(limit, cursor)
    return success_response({'events': events, 'next_cursor': next_cursor})
