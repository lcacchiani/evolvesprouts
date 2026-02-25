"""CloudFront signed URL helpers for long-lived asset downloads."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import quote

from botocore.signers import CloudFrontSigner
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.services.secrets import get_secret_json

_PRIVATE_KEY_FIELDS = ("private_key_pem", "privateKeyPem", "private_key")
_DEFAULT_SIGNER_CACHE_TTL_SECONDS = 300
_MIN_SIGNER_CACHE_TTL_SECONDS = 30
_MAX_SIGNER_CACHE_TTL_SECONDS = 3600


@dataclass(frozen=True)
class _SignerCacheEntry:
    cache_key: str
    loaded_at_monotonic: float
    signer: CloudFrontSigner


_SIGNER_CACHE: _SignerCacheEntry | None = None


def generate_signed_download_url(*, s3_key: str, expires_at: datetime) -> str:
    """Generate a CloudFront signed URL for an S3-backed object key."""
    if expires_at.tzinfo is None:
        raise RuntimeError("expires_at must be timezone-aware")

    distribution_domain = _required_env("ASSET_DOWNLOAD_CLOUDFRONT_DOMAIN")
    key_pair_id = _required_env("ASSET_DOWNLOAD_CLOUDFRONT_KEY_PAIR_ID")
    secret_arn = _required_env("ASSET_DOWNLOAD_CLOUDFRONT_PRIVATE_KEY_SECRET_ARN")

    normalized_key = s3_key.strip().lstrip("/")
    if not normalized_key:
        raise RuntimeError("s3_key is required for signed download URL")

    resource_url = (
        f"https://{distribution_domain}/{quote(normalized_key, safe='/_.-~')}"
    )
    signer = _get_signer(key_pair_id=key_pair_id, secret_arn=secret_arn)
    return signer.generate_presigned_url(resource_url, date_less_than=expires_at)


def clear_signer_cache() -> None:
    """Clear signer cache (used by tests and key-rotation flows)."""
    global _SIGNER_CACHE
    _SIGNER_CACHE = None


def _get_signer(*, key_pair_id: str, secret_arn: str) -> CloudFrontSigner:
    global _SIGNER_CACHE

    cache_key = f"{key_pair_id}:{secret_arn}"
    now_monotonic = time.monotonic()
    cache_ttl_seconds = _signer_cache_ttl_seconds()

    if (
        _SIGNER_CACHE is not None
        and _SIGNER_CACHE.cache_key == cache_key
        and now_monotonic - _SIGNER_CACHE.loaded_at_monotonic <= cache_ttl_seconds
    ):
        return _SIGNER_CACHE.signer

    private_key = _load_private_key(secret_arn)

    def rsa_signer(message: bytes) -> bytes:
        # CloudFront signed URL verification requires RSA-SHA1 compatibility.
        return private_key.sign(
            message,
            padding.PKCS1v15(),
            hashes.SHA1(),  # nosec B303  # nosemgrep: python.cryptography.security.insecure-hash-algorithms.insecure-hash-algorithm-sha1
        )

    signer = CloudFrontSigner(key_pair_id, rsa_signer)
    _SIGNER_CACHE = _SignerCacheEntry(
        cache_key=cache_key,
        loaded_at_monotonic=now_monotonic,
        signer=signer,
    )
    return signer


def _load_private_key(secret_arn: str) -> rsa.RSAPrivateKey:
    payload = get_secret_json(secret_arn)

    private_key_pem: str | None = None
    for field in _PRIVATE_KEY_FIELDS:
        candidate = payload.get(field)
        if isinstance(candidate, str) and candidate.strip():
            private_key_pem = candidate
            break

    if not private_key_pem:
        raise RuntimeError(
            "CloudFront signer private key secret must include private_key_pem"
        )

    loaded_key = serialization.load_pem_private_key(
        private_key_pem.encode("utf-8"),
        password=None,
    )
    if not isinstance(loaded_key, rsa.RSAPrivateKey):
        raise RuntimeError("CloudFront signer private key must be an RSA key")
    return loaded_key


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def _signer_cache_ttl_seconds() -> int:
    raw = os.getenv(
        "ASSET_DOWNLOAD_SIGNER_CACHE_TTL_SECONDS",
        f"{_DEFAULT_SIGNER_CACHE_TTL_SECONDS}",
    ).strip()
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise RuntimeError(
            "ASSET_DOWNLOAD_SIGNER_CACHE_TTL_SECONDS must be an integer"
        ) from exc
    return max(
        _MIN_SIGNER_CACHE_TTL_SECONDS,
        min(_MAX_SIGNER_CACHE_TTL_SECONDS, parsed),
    )
