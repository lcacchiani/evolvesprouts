from __future__ import annotations

from app.auth.authorizer_utils import (
    build_iam_policy,
    extract_bearer_token,
    extract_organization_ids,
    get_header_case_insensitive,
)


def test_get_header_case_insensitive_returns_matching_value() -> None:
    headers = {"Authorization": "Bearer token-123"}
    assert get_header_case_insensitive(headers, "authorization") == "Bearer token-123"


def test_extract_bearer_token_supports_bearer_and_raw_values() -> None:
    assert extract_bearer_token({"Authorization": "Bearer abc.def"}) == "abc.def"
    assert extract_bearer_token({"authorization": "raw-token"}) == "raw-token"
    assert extract_bearer_token({}) is None


def test_extract_organization_ids_handles_list_and_csv_claims() -> None:
    assert extract_organization_ids({"custom:organization_ids": [" org-1 ", "org-2"]}) == {
        "org-1",
        "org-2",
    }
    assert extract_organization_ids({"organization_id": "org-a, org-b"}) == {
        "org-a",
        "org-b",
    }


def test_build_iam_policy_broadens_allow_resource_by_default() -> None:
    method_arn = (
        "arn:aws:execute-api:ap-southeast-1:123456789012:api-id/prod/GET/v1/assets/public"
    )
    policy = build_iam_policy("Allow", method_arn, "user-1", {"group": "admin"})

    statement = policy["policyDocument"]["Statement"][0]
    assert statement["Resource"] == (
        "arn:aws:execute-api:ap-southeast-1:123456789012:api-id/prod/*"
    )


def test_build_iam_policy_keeps_exact_resource_when_broadening_disabled() -> None:
    method_arn = (
        "arn:aws:execute-api:ap-southeast-1:123456789012:api-id/prod/GET/v1/assets/public"
    )
    policy = build_iam_policy(
        "Allow",
        method_arn,
        "device-1",
        {"attested": "true"},
        broaden_resource=False,
    )

    statement = policy["policyDocument"]["Statement"][0]
    assert statement["Resource"] == method_arn
