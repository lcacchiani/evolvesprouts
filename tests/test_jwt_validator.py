from __future__ import annotations

from unittest.mock import MagicMock

import jwt
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


def test_get_allowed_client_ids_fails_closed_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("COGNITO_ALLOWED_CLIENT_IDS", raising=False)
    with pytest.raises(jwt_validator.JWTValidationError, match="not configured"):
        jwt_validator._get_allowed_client_ids()


def test_verify_token_client_claim_rejects_invalid_audience(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("COGNITO_ALLOWED_CLIENT_IDS", "allowed-client")
    with pytest.raises(jwt_validator.JWTValidationError, match="not an allowed client"):
        jwt_validator._verify_token_client_claim(
            {"aud": "other-client", "token_use": "id"},
            "id",
        )


def test_verify_token_client_claim_accepts_access_token_client_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("COGNITO_ALLOWED_CLIENT_IDS", "allowed-client")
    jwt_validator._verify_token_client_claim(
        {"client_id": "allowed-client"},
        "access",
    )


def test_decode_and_verify_token_checks_aud_for_id_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("COGNITO_ALLOWED_CLIENT_IDS", "allowed-client")
    monkeypatch.setattr(
        jwt_validator,
        "_extract_unverified_claims",
        lambda _token: {
            "iss": "https://cognito-idp.ap-southeast-1.amazonaws.com/pool",
        },
    )
    fake_jwks = MagicMock()
    fake_jwks.get_signing_key_from_jwt.return_value = MagicMock(key="secret")
    monkeypatch.setattr(
        jwt_validator,
        "_get_jwks_client",
        lambda *_args, **_kwargs: fake_jwks,
    )
    monkeypatch.setattr(
        jwt_validator.jwt,
        "decode",
        lambda *_args, **_kwargs: {
            "sub": "user-1",
            "iss": "https://cognito-idp.ap-southeast-1.amazonaws.com/pool",
            "exp": 9999999999,
            "token_use": "id",
            "aud": "allowed-client",
            "email": "a@b.com",
            "cognito:groups": [],
        },
    )
    claims = jwt_validator.decode_and_verify_token(
        "header.payload.signature",
        user_pool_id="pool",
        region="ap-southeast-1",
    )
    assert claims.sub == "user-1"
