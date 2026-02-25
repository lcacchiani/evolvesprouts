"""Helpers for stable asset share-link tokens and URLs."""

from __future__ import annotations

import os
import re
import secrets
from typing import Any, Mapping

_SHARE_TOKEN_BYTES = 24
_SHARE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{24,128}$")
_SHARE_PATH_PREFIX = "/v1/assets/share"


def generate_share_token() -> str:
    """Generate a URL-safe bearer token for asset sharing."""
    return secrets.token_urlsafe(_SHARE_TOKEN_BYTES)


def is_valid_share_token(token: str) -> bool:
    """Return whether a token matches the accepted share-token format."""
    return bool(_SHARE_TOKEN_RE.fullmatch(token))


def build_share_link_url(event: Mapping[str, Any], token: str) -> str:
    """Build the stable public share URL for a token."""
    configured_base = os.getenv("ASSET_SHARE_LINK_BASE_URL", "").strip().rstrip("/")
    if configured_base:
        return f"{configured_base}{_SHARE_PATH_PREFIX}/{token}"

    request_base = _derive_request_base_url(event).rstrip("/")
    return f"{request_base}{_SHARE_PATH_PREFIX}/{token}"


def _derive_request_base_url(event: Mapping[str, Any]) -> str:
    headers = event.get("headers")
    if not isinstance(headers, Mapping):
        raise RuntimeError("Request headers are required to build share links")

    host = _to_non_empty_string(headers.get("host") or headers.get("Host"))
    if not host:
        raise RuntimeError("Host header is required to build share links")

    scheme = (
        _to_non_empty_string(headers.get("x-forwarded-proto"))
        or _to_non_empty_string(headers.get("X-Forwarded-Proto"))
        or "https"
    )

    event_path = _to_non_empty_string(event.get("path")) or ""
    request_context = event.get("requestContext")
    request_context_path = ""
    if isinstance(request_context, Mapping):
        request_context_path = _to_non_empty_string(request_context.get("path")) or ""

    base_path = ""
    if request_context_path and event_path and request_context_path.endswith(event_path):
        base_path = request_context_path[: -len(event_path)]

    return f"{scheme}://{host}{base_path}"


def _to_non_empty_string(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        return normalized if normalized else None
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized if normalized else None
