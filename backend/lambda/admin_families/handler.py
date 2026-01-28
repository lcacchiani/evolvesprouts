import os
import sys
from typing import Any, Dict

BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..'),
)
SRC_DIR = os.path.join(BASE_DIR, 'src')
if SRC_DIR not in sys.path:
    sys.path.append(SRC_DIR)

from app.auth import require_admin
from app.config import load_config
from app.errors import ApiError, internal_error
from app.http import error_response, json_response, parse_cursor, parse_limit
from app.services.families_service import get_families


def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    try:
        require_admin(event)
        config = load_config()
        limit = parse_limit(event, config.families_limit)
        cursor = parse_cursor(event)
        families, next_cursor = get_families(limit, cursor)
        return json_response(
            200,
            {'families': families, 'next_cursor': next_cursor},
        )
    except ApiError as exc:
        return error_response(exc)
    except Exception:
        return error_response(internal_error())
