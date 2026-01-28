import os
import sys
from typing import Any, Dict

BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..'),
)
SRC_DIR = os.path.join(BASE_DIR, 'src')
if SRC_DIR not in sys.path:
    sys.path.append(SRC_DIR)

from app.errors import ApiError, internal_error
from app.http import error_response, json_response, parse_body
from app.services.auth_service import build_login_url


def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    try:
        payload = parse_body(event)
        redirect_uri = payload.get('redirect_uri')
        state = payload.get('state')
        login_url = build_login_url(redirect_uri, state)
        return json_response(200, {'login_url': login_url})
    except ApiError as exc:
        return error_response(exc)
    except Exception:
        return error_response(internal_error())
