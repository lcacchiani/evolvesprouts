"""Auth login Lambda handler."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict

# Bootstrap: Add src directory to Python path
_src_dir = str(Path(__file__).resolve().parents[2] / 'src')
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from app.handler import lambda_handler, success_response
from app.http import parse_body
from app.services.auth_service import build_login_url


@lambda_handler()
def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Generate Cognito hosted UI login URL.

    Request Body (optional):
        state: OAuth state parameter for CSRF protection.

    Returns:
        JSON response with login_url.
    """
    payload = parse_body(event)
    state = payload.get('state')
    login_url = build_login_url(state)
    return success_response({'login_url': login_url})
