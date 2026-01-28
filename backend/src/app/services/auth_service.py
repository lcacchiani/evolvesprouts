from typing import Optional
from urllib.parse import urlencode

from app.config import load_config
from app.errors import internal_error

DEFAULT_SCOPES = ['openid', 'email', 'profile']


def build_login_url(state: Optional[str]) -> str:
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
