from __future__ import annotations

import pytest

from app.auth import jwt_validator


def test_extract_unverified_claims_rejects_invalid_token_format() -> None:
    with pytest.raises(jwt_validator.JWTValidationError, match="expected 3 parts"):
        jwt_validator._extract_unverified_claims("not-a-jwt")


def test_extract_user_pool_from_issuer_parses_region_and_pool_id() -> None:
    region, pool_id = jwt_validator._extract_user_pool_from_issuer(
        "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_abc123"
    )

    assert region == "ap-southeast-1"
    assert pool_id == "ap-southeast-1_abc123"


def test_extract_user_pool_from_issuer_rejects_invalid_issuer() -> None:
    with pytest.raises(jwt_validator.JWTValidationError, match="Invalid issuer format"):
        jwt_validator._extract_user_pool_from_issuer("https://example.com/issuer")
