"""Admin families Lambda handler."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict

# Bootstrap: Add src directory to Python path
_src_dir = str(Path(__file__).resolve().parents[2] / 'src')
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

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
