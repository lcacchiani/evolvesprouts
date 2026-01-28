"""Authentication service for Cognito integration.

This module provides OAuth/OIDC flow utilities for Cognito hosted UI.
"""

from __future__ import annotations

from typing import Optional
from urllib.parse import urlencode

from app.config import load_config
from app.errors import internal_error

# Default OAuth scopes for user authentication
DEFAULT_SCOPES = ['openid', 'email', 'profile']


def build_login_url(state: Optional[str] = None) -> str:
    """Build Cognito hosted UI authorization URL.

    Constructs the OAuth 2.0 authorization endpoint URL for the
    Cognito hosted UI, including the configured client ID, redirect
    URI, and requested scopes.

    Args:
        state: Optional OAuth state parameter for CSRF protection.
               Should be a random string that the client can verify
               in the callback.

    Returns:
        Full authorization URL to redirect the user to.

    Raises:
        ApiError: If Cognito is not configured (500 internal_error).

    Example:
        url = build_login_url(state='abc123')
        # Returns: https://domain.auth.region.amazoncognito.com/oauth2/...
    """
    config = load_config()
    domain = config.cognito_domain
    client_id = config.cognito_client_id
    if not domain or not client_id:
        raise internal_error('cognito_not_configured')
    if not config.cognito_redirect_uri:
        raise internal_error('redirect_uri_required')

    params = {
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': config.cognito_redirect_uri,
        'scope': ' '.join(DEFAULT_SCOPES),
    }
    if state:
        params['state'] = state

    return f'https://{domain}/oauth2/authorize?{urlencode(params)}'
