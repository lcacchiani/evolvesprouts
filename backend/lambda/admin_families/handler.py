"""Admin families Lambda handler."""

from __future__ import annotations

from typing import Any, Dict

import _bootstrap  # noqa: F401

from app.auth import require_admin
from app.config import load_config
from app.handler import lambda_handler, success_response
from app.http import parse_cursor, parse_limit
from app.services.families_service import get_families


@lambda_handler()
def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """List families for admin users with pagination.

    Requires admin group membership via JWT authorizer.

    Query Parameters:
        limit: Maximum results to return (default from config).
        cursor: Pagination cursor for next page.

    Returns:
        JSON response with families array and next_cursor.
    """
    require_admin(event)
    config = load_config()
    limit = parse_limit(event, config.families_limit)
    cursor = parse_cursor(event)
    families, next_cursor = get_families(limit, cursor)
    return success_response({'families': families, 'next_cursor': next_cursor})
