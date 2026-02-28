"""Shared helpers for API Gateway authorizers and token extraction."""

from __future__ import annotations

from typing import Any, Mapping


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

