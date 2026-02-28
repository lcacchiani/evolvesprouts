from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from app.exceptions import ConfigurationError
from app.services import cloudfront_signing


class _DummySigner:
    def __init__(self) -> None:
        self.resource_url: str | None = None
        self.date_less_than: datetime | None = None

    def generate_presigned_url(self, resource_url: str, date_less_than: datetime) -> str:
        self.resource_url = resource_url
        self.date_less_than = date_less_than
        return "https://signed.example.com/download"


def test_generate_signed_download_url_uses_cloudfront_signer(monkeypatch: Any) -> None:
    monkeypatch.setenv("ASSET_DOWNLOAD_CLOUDFRONT_DOMAIN", "d111111abcdef8.cloudfront.net")
    monkeypatch.setenv("ASSET_DOWNLOAD_CLOUDFRONT_KEY_PAIR_ID", "K123EXAMPLE")
    monkeypatch.setenv(
        "ASSET_DOWNLOAD_CLOUDFRONT_PRIVATE_KEY_SECRET_ARN",
        "arn:aws:secretsmanager:ap-southeast-1:111111111111:secret:cf/private",
    )

    dummy = _DummySigner()
    captured: dict[str, str] = {}

    def fake_get_signer(*, key_pair_id: str, secret_arn: str) -> _DummySigner:
        captured["key_pair_id"] = key_pair_id
        captured["secret_arn"] = secret_arn
        return dummy

    monkeypatch.setattr(cloudfront_signing, "_get_signer", fake_get_signer)

    expires_at = datetime(2035, 1, 1, 12, 0, tzinfo=UTC)
    result = cloudfront_signing.generate_signed_download_url(
        s3_key="assets/guide one.pdf",
        expires_at=expires_at,
    )

    assert result == "https://signed.example.com/download"
    assert captured == {
        "key_pair_id": "K123EXAMPLE",
        "secret_arn": "arn:aws:secretsmanager:ap-southeast-1:111111111111:secret:cf/private",
    }
    assert (
        dummy.resource_url
        == "https://d111111abcdef8.cloudfront.net/assets/guide%20one.pdf"
    )
    assert dummy.date_less_than == expires_at


def test_generate_signed_download_url_requires_timezone_aware_datetime(
    monkeypatch: Any,
) -> None:
    monkeypatch.setenv("ASSET_DOWNLOAD_CLOUDFRONT_DOMAIN", "d111111abcdef8.cloudfront.net")
    monkeypatch.setenv("ASSET_DOWNLOAD_CLOUDFRONT_KEY_PAIR_ID", "K123EXAMPLE")
    monkeypatch.setenv(
        "ASSET_DOWNLOAD_CLOUDFRONT_PRIVATE_KEY_SECRET_ARN",
        "arn:aws:secretsmanager:ap-southeast-1:111111111111:secret:cf/private",
    )
    monkeypatch.setattr(cloudfront_signing, "_get_signer", lambda **_: _DummySigner())

    with pytest.raises(RuntimeError, match="timezone-aware"):
        cloudfront_signing.generate_signed_download_url(
            s3_key="assets/doc.pdf",
            expires_at=datetime(2035, 1, 1, 12, 0),
        )


def test_get_signer_uses_sha1_for_cloudfront_compatibility(monkeypatch: Any) -> None:
    cloudfront_signing.clear_signer_cache()

    class _FakePrivateKey:
        def __init__(self) -> None:
            self.message: bytes | None = None
            self.padding_name: str | None = None
            self.algorithm_name: str | None = None

        def sign(self, message: bytes, applied_padding: Any, algorithm: Any) -> bytes:
            self.message = message
            self.padding_name = type(applied_padding).__name__
            self.algorithm_name = type(algorithm).__name__
            return b"signature"

    fake_key = _FakePrivateKey()
    captured: dict[str, Any] = {}

    class _CapturingSigner:
        def __init__(self, key_pair_id: str, signer: Any) -> None:
            captured["key_pair_id"] = key_pair_id
            captured["signer"] = signer

    monkeypatch.setattr(cloudfront_signing, "_load_private_key", lambda _: fake_key)
    monkeypatch.setattr(cloudfront_signing, "CloudFrontSigner", _CapturingSigner)

    signer = cloudfront_signing._get_signer(
        key_pair_id="K123EXAMPLE",
        secret_arn="arn:aws:secretsmanager:ap-southeast-1:111111111111:secret:cf/private",
    )
    assert isinstance(signer, _CapturingSigner)
    assert captured["key_pair_id"] == "K123EXAMPLE"

    signature = captured["signer"](b"payload")
    assert signature == b"signature"
    assert fake_key.message == b"payload"
    assert fake_key.padding_name == "PKCS1v15"
    assert fake_key.algorithm_name == "SHA1"

    cloudfront_signing.clear_signer_cache()


def test_load_private_key_requires_pem_field(monkeypatch: Any) -> None:
    monkeypatch.setattr(cloudfront_signing, "get_secret_json", lambda _: {})
    with pytest.raises(RuntimeError, match="private_key_pem"):
        cloudfront_signing._load_private_key("arn:example")


def test_generate_signed_download_url_requires_configured_env(monkeypatch: Any) -> None:
    monkeypatch.delenv("ASSET_DOWNLOAD_CLOUDFRONT_DOMAIN", raising=False)
    monkeypatch.delenv("ASSET_DOWNLOAD_CLOUDFRONT_KEY_PAIR_ID", raising=False)
    monkeypatch.delenv(
        "ASSET_DOWNLOAD_CLOUDFRONT_PRIVATE_KEY_SECRET_ARN",
        raising=False,
    )

    with pytest.raises(ConfigurationError, match="ASSET_DOWNLOAD_CLOUDFRONT_DOMAIN"):
        cloudfront_signing.generate_signed_download_url(
            s3_key="assets/doc.pdf",
            expires_at=datetime(2035, 1, 1, 12, 0, tzinfo=UTC),
        )
