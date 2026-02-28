"""Cloudflare Turnstile verification helpers."""

from __future__ import annotations

import json
import os
from typing import Any
from collections.abc import Mapping
from urllib.parse import urlencode

from app.services.aws_proxy import AwsProxyError, http_invoke
from app.utils.logging import get_logger

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

logger = get_logger(__name__)


def extract_turnstile_token(event: Mapping[str, Any]) -> str:
    """Return the Turnstile token from request headers."""
    headers = event.get("headers") or {}
    if not isinstance(headers, Mapping):
        return ""

    for key, value in headers.items():
        if str(key).lower() == "x-turnstile-token":
            return str(value).strip()
    return ""


def extract_client_ip(event: Mapping[str, Any]) -> str | None:
    """Extract the caller IP from API Gateway event data."""
    headers = event.get("headers") or {}
    if isinstance(headers, Mapping):
        for key, value in headers.items():
            if str(key).lower() == "x-forwarded-for":
                ip = str(value).split(",")[0].strip()
                if ip:
                    return ip

    request_context = event.get("requestContext") or {}
    if not isinstance(request_context, Mapping):
        return None

    identity = request_context.get("identity") or {}
    if isinstance(identity, Mapping):
        source_ip = str(identity.get("sourceIp") or "").strip()
        if source_ip:
            return source_ip

    http_context = request_context.get("http") or {}
    if isinstance(http_context, Mapping):
        source_ip = str(http_context.get("sourceIp") or "").strip()
        if source_ip:
            return source_ip

    return None


def verify_turnstile_token(token: str, remote_ip: str | None = None) -> bool:
    """Verify a Turnstile response token with Cloudflare."""
    normalized_token = token.strip()
    if not normalized_token:
        return False

    secret_key = os.getenv("TURNSTILE_SECRET_KEY", "").strip()
    if not secret_key:
        logger.error("TURNSTILE_SECRET_KEY is not configured")
        return False

    request_data = {
        "secret": secret_key,
        "response": normalized_token,
    }
    if remote_ip:
        request_data["remoteip"] = remote_ip

    try:
        response = http_invoke(
            method="POST",
            url=TURNSTILE_VERIFY_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            body=urlencode(request_data),
            timeout=10,
        )
    except AwsProxyError as exc:
        logger.warning(
            "Turnstile verification request failed via proxy",
            extra={"code": exc.code},
        )
        return False

    try:
        status_code = int(response.get("status") or 0)
    except (TypeError, ValueError):
        status_code = 0
    if status_code != 200:
        logger.warning(
            "Turnstile verification returned non-200 status",
            extra={"status_code": status_code},
        )
        return False

    raw_response_body = response.get("body") or "{}"
    try:
        parsed_response = json.loads(raw_response_body)
    except json.JSONDecodeError:
        logger.warning("Turnstile verification returned invalid JSON body")
        return False

    if not isinstance(parsed_response, Mapping):
        logger.warning("Turnstile verification response is not a JSON object")
        return False

    is_success = parsed_response.get("success") is True
    if not is_success:
        error_codes = parsed_response.get("error-codes")
        logger.info(
            "Turnstile verification rejected token",
            extra={"error_codes": error_codes if isinstance(error_codes, list) else []},
        )

    return is_success
