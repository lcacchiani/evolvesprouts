from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

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


def test_load_private_key_requires_pem_field(monkeypatch: Any) -> None:
    monkeypatch.setattr(cloudfront_signing, "get_secret_json", lambda _: {})
    with pytest.raises(RuntimeError, match="private_key_pem"):
        cloudfront_signing._load_private_key("arn:example")
