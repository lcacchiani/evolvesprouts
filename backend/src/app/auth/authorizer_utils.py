"""Shared helpers for API Gateway authorizers and token extraction."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from collections.abc import Mapping

from app.auth.jwt_validator import (
    JWTValidationError,
    TokenClaims,
    decode_and_verify_token,
)


def get_header_case_insensitive(headers: Mapping[str, Any], name: str) -> str:
    """Get a header value case-insensitively."""
    for key, value in headers.items():
        if key.lower() == name.lower():
            return str(value)
    return ""


def extract_bearer_token(headers: Mapping[str, Any]) -> str | None:
    """Extract a bearer token from Authorization headers.

    Supports either ``Bearer <token>`` or raw-token values for compatibility.
    """
    auth_header = get_header_case_insensitive(headers, "authorization")
    if not auth_header:
        return None

    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        return token if token else None

    token = auth_header.strip()
    return token if token else None


def extract_organization_ids(raw_claims: Mapping[str, Any]) -> set[str]:
    """Extract organization IDs from common Cognito custom-claim keys."""
    claim_value = (
        raw_claims.get("custom:organization_ids")
        or raw_claims.get("custom:organization_id")
        or raw_claims.get("organization_ids")
        or raw_claims.get("organization_id")
    )
    if claim_value is None:
        return set()
    if isinstance(claim_value, list):
        values = [str(item).strip() for item in claim_value]
    else:
        values = [part.strip() for part in str(claim_value).split(",")]
    return {value for value in values if value}


def build_iam_policy(
    effect: str,
    method_arn: str,
    principal_id: str,
    context: Mapping[str, Any],
    *,
    broaden_resource: bool = True,
) -> dict[str, Any]:
    """Build an IAM policy document for API Gateway authorizers."""
    resource = method_arn
    if effect == "Allow" and broaden_resource:
        parts = method_arn.split("/")
        if len(parts) >= 2:
            resource = "/".join(parts[:2]) + "/*"

    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
        "context": dict(context),
    }


def deny_missing_token(method_arn: str) -> dict[str, Any]:
    """Build a Deny policy for requests without a bearer token."""
    return build_iam_policy(
        "Deny",
        method_arn,
        "anonymous",
        {"reason": "missing_token"},
    )


def deny_invalid_token(
    method_arn: str, reason: str = "invalid_token"
) -> dict[str, Any]:
    """Build a Deny policy for invalid bearer token requests."""
    return build_iam_policy("Deny", method_arn, "invalid", {"reason": reason})


def decode_authorizer_claims(event: Mapping[str, Any]) -> TokenClaims:
    """Extract and validate Cognito JWT claims from an authorizer event."""
    headers = event.get("headers") or {}
    if not isinstance(headers, Mapping):
        headers = {}
    token = extract_bearer_token(headers)
    if not token:
        raise JWTValidationError("Missing bearer token", reason="missing_token")
    return decode_and_verify_token(token)


def build_allow_context(claims: TokenClaims) -> dict[str, str]:
    """Build the common IAM authorizer context from verified claims."""
    organization_ids = extract_organization_ids(claims.raw_claims)
    return {
        "userSub": claims.sub,
        "email": claims.email,
        "groups": ",".join(claims.groups),
        "organizationIds": ",".join(sorted(organization_ids)),
    }


@dataclass(frozen=True)
class VerifiedCognitoContext:
    """Verified Cognito identity data or a Deny policy when verification failed."""

    claims: TokenClaims | None
    policy: dict[str, Any] | None = None

    @property
    def user_sub(self) -> str:
        return self.claims.sub if self.claims is not None else ""

    @property
    def email(self) -> str:
        return self.claims.email if self.claims is not None else ""

    @property
    def groups(self) -> list[str]:
        return list(self.claims.groups) if self.claims is not None else []

    @property
    def organization_ids(self) -> set[str]:
        if self.claims is None:
            return set()
        return extract_organization_ids(self.claims.raw_claims)

    def policy_context(self) -> dict[str, str]:
        if self.claims is None:
            return {}
        return build_allow_context(self.claims)


def verified_cognito_context_from_event(
    event: Mapping[str, Any],
    *,
    method_arn: str,
    logger: Any,
) -> VerifiedCognitoContext:
    """Return verified Cognito context, or a Deny policy for auth failures."""
    try:
        claims = decode_authorizer_claims(event)
        return VerifiedCognitoContext(claims=claims)
    except JWTValidationError as exc:
        if exc.reason == "missing_token":
            logger.warning("Missing or invalid Authorization header")
            return VerifiedCognitoContext(
                claims=None,
                policy=deny_missing_token(method_arn),
            )
        logger.warning(f"JWT validation failed: {exc.message} (reason: {exc.reason})")
        return VerifiedCognitoContext(
            claims=None,
            policy=deny_invalid_token(method_arn, exc.reason),
        )
    except Exception as exc:
        # SECURITY: Do not expose internal error details in the authorizer context.
        logger.warning(f"Token validation failed: {type(exc).__name__}")
        return VerifiedCognitoContext(
            claims=None,
            policy=deny_invalid_token(method_arn),
        )


def verify_cognito_authorizer_claims(
    event: Mapping[str, Any],
    method_arn: str,
    *,
    logger: Any,
) -> VerifiedCognitoContext:
    """Compatibility wrapper for handlers that need raw verified claims."""
    return verified_cognito_context_from_event(
        event,
        method_arn=method_arn,
        logger=logger,
    )
