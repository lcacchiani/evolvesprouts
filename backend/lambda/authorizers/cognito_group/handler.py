"""API Gateway request authorizer for Cognito group-based access control.

This Lambda validates JWT tokens with proper signature verification and checks
if the user belongs to the required Cognito groups before allowing access.

SECURITY NOTES:
- JWT signatures are verified using Cognito's JWKS endpoint
- Token expiration is validated to prevent replay attacks
- Issuer is verified to prevent token confusion attacks

Environment Variables:
    ALLOWED_GROUPS: Comma-separated list of groups that can access the endpoint
                    (e.g., "admin,manager,instructor")
"""

from __future__ import annotations

import os
from typing import Any

from app.auth.authorizer_utils import (
    build_iam_policy,
    extract_organization_ids,
    verify_cognito_authorizer_claims,
)
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Authorize requests based on Cognito group membership.

    This authorizer:
    1. Extracts the JWT token from the Authorization header
    2. Verifies the token signature using Cognito's JWKS
    3. Validates token expiration and issuer
    4. Checks if the user belongs to any of the allowed groups

    Args:
        event: API Gateway authorizer event containing headers and methodArn
        _context: Lambda context (unused)

    Returns:
        IAM policy document allowing or denying the request
    """
    method_arn = event.get("methodArn", "")

    # Get configuration
    allowed_groups_str = os.getenv("ALLOWED_GROUPS", "")
    if not allowed_groups_str:
        logger.error("ALLOWED_GROUPS environment variable not configured")
        return build_iam_policy(
            "Deny",
            method_arn,
            "misconfigured",
            {"reason": "misconfigured"},
        )

    allowed_groups = {g.strip() for g in allowed_groups_str.split(",") if g.strip()}

    claims_result = verify_cognito_authorizer_claims(event, method_arn, logger=logger)
    if claims_result.policy is not None:
        return claims_result.policy
    claims = claims_result.claims
    if claims is None:  # pragma: no cover - defensive invariant
        return build_iam_policy(
            "Deny",
            method_arn,
            "invalid",
            {"reason": "invalid_token"},
        )

    user_sub = claims.sub
    email = claims.email
    user_groups = set(claims.groups)
    organization_ids = extract_organization_ids(claims.raw_claims)

    # Check if user is in any of the allowed groups
    matching_groups = user_groups & allowed_groups

    if matching_groups:
        logger.info(
            f"Access granted for user {user_sub[:8]}*** "
            f"(groups: {', '.join(matching_groups)})"
        )
        return build_iam_policy(
            "Allow",
            method_arn,
            user_sub,
            {
                "userSub": user_sub,
                "email": email,
                "groups": ",".join(user_groups),
                "matchedGroups": ",".join(matching_groups),
                "organizationIds": ",".join(sorted(organization_ids)),
            },
        )

    logger.warning(
        f"Access denied for user {user_sub[:8]}*** "
        f"(user groups: {user_groups}, required: {allowed_groups})"
    )
    return build_iam_policy(
        "Deny",
        method_arn,
        user_sub,
        {"reason": "insufficient_permissions", "userSub": user_sub},
    )
