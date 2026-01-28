"""Auth login Lambda handler."""

from __future__ import annotations

from typing import Any, Dict

import _bootstrap  # noqa: F401

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
