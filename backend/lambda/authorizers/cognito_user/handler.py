"""API Gateway request authorizer for any authenticated Cognito user.

This Lambda validates JWT tokens with proper signature verification and allows
access to any authenticated user, regardless of their Cognito group membership.

SECURITY NOTES:
- JWT signatures are verified using Cognito's JWKS endpoint
- Token expiration is validated to prevent replay attacks
- Issuer is verified to prevent token confusion attacks

Use this for endpoints that require authentication but not specific role-based
permissions.
"""

from __future__ import annotations

from typing import Any

from app.auth.authorizer_utils import (
    build_iam_policy,
    verified_cognito_context_from_event,
)
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Authorize requests for any authenticated Cognito user.

    This authorizer:
    1. Extracts the JWT token from the Authorization header
    2. Verifies the token signature using Cognito's JWKS
    3. Validates token expiration and issuer
    4. Grants access to any valid authenticated user

    Args:
        event: API Gateway authorizer event containing headers and methodArn
        _context: Lambda context (unused)

    Returns:
        IAM policy document allowing or denying the request
    """
    method_arn = event.get("methodArn", "")
    verified = verified_cognito_context_from_event(
        event,
        method_arn=method_arn,
        logger=logger,
    )
    if verified.policy is not None:
        return verified.policy

    logger.info(
        f"Access granted for authenticated user {verified.user_sub[:8]}*** "
        f"(groups: {', '.join(verified.groups) if verified.groups else 'none'})"
    )
    return build_iam_policy(
        "Allow",
        method_arn,
        verified.user_sub,
        verified.policy_context(),
    )
