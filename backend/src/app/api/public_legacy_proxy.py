"""Legacy public API proxy handlers.

This module provides migration bridge endpoints under /v1/legacy/*
and /www/v1/legacy/* that proxy to legacy public API routes.
"""

from __future__ import annotations

import json
import os
from typing import Any
from collections.abc import Mapping
from urllib.parse import urljoin

from app.api.admin_request import parse_body
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.services.turnstile import extract_turnstile_token
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_DEFAULT_ERROR_MESSAGE = "Unable to process request. Please try again."
_MAX_BODY_BYTES = 20_000
_CONTENT_TYPE_JSON = "application/json"

_LEGACY_RESERVATIONS_PATH = "/v1/reservations"
_LEGACY_CONTACT_US_PATH = "/v1/contact-us"
_LEGACY_DISCOUNT_VALIDATE_PATH = "/v1/discounts/validate"
_LEGACY_API_KEY_ENV_NAME = "LEGACY_PUBLIC_API_KEY"

_SUCCESS_STATUS_BY_LEGACY_PATH: dict[str, tuple[int, ...]] = {
    _LEGACY_RESERVATIONS_PATH: (200, 202),
    _LEGACY_CONTACT_US_PATH: (200, 202),
    _LEGACY_DISCOUNT_VALIDATE_PATH: (200, 202),
}
_RETRYABLE_STATUS_CODES = {500, 502, 503, 504}


def handle_legacy_reservations(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Proxy reservation submissions to legacy public API."""
    return _handle_legacy_proxy(
        event=event,
        method=method,
        target_path=_LEGACY_RESERVATIONS_PATH,
        include_turnstile=True,
    )


def handle_legacy_contact_us(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Proxy contact-us submissions to legacy public API."""
    return _handle_legacy_proxy(
        event=event,
        method=method,
        target_path=_LEGACY_CONTACT_US_PATH,
        include_turnstile=False,
    )


def handle_legacy_discount_validate(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Proxy discount validation to legacy public API."""
    return _handle_legacy_proxy(
        event=event,
        method=method,
        target_path=_LEGACY_DISCOUNT_VALIDATE_PATH,
        include_turnstile=False,
    )


def _handle_legacy_proxy(
    *,
    event: Mapping[str, Any],
    method: str,
    target_path: str,
    include_turnstile: bool,
) -> dict[str, Any]:
    if method != "POST":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    legacy_base_url = _legacy_base_url()
    if not legacy_base_url:
        logger.error("LEGACY_PUBLIC_API_BASE_URL is not configured")
        return json_response(
            500,
            {"error": "Service configuration error. Please contact support."},
            event=event,
        )

    try:
        payload = parse_body(event)
    except Exception as exc:
        logger.warning(
            "Legacy proxy payload parsing failed",
            extra={"path": target_path, "error": type(exc).__name__},
        )
        return json_response(400, {"error": "Request body must be valid JSON"}, event=event)

    request_body = json.dumps(payload, separators=(",", ":"))
    if len(request_body.encode("utf-8")) > _MAX_BODY_BYTES:
        return json_response(413, {"error": "Request body too large"}, event=event)

    request_headers: dict[str, str] = {"Content-Type": _CONTENT_TYPE_JSON}
    inbound_api_key = _get_header_case_insensitive(event, "x-api-key")
    if inbound_api_key:
        request_headers["x-api-key"] = inbound_api_key
    elif _legacy_api_key():
        request_headers["x-api-key"] = _legacy_api_key()
    if include_turnstile:
        turnstile_token = extract_turnstile_token(event)
        if turnstile_token:
            request_headers["X-Turnstile-Token"] = turnstile_token

    request_url = _build_legacy_url(legacy_base_url, target_path)
    proxy_result = _invoke_legacy_url(
        method="POST",
        url=request_url,
        headers=request_headers,
        body=request_body,
    )
    return _normalize_proxy_response(
        proxy_result=proxy_result,
        target_path=target_path,
        event=event,
    )


def _legacy_base_url() -> str:
    return os.getenv("LEGACY_PUBLIC_API_BASE_URL", "").strip().rstrip("/")


def _legacy_api_key() -> str:
    return os.getenv(_LEGACY_API_KEY_ENV_NAME, "").strip()


def _build_legacy_url(base_url: str, path: str) -> str:
    return urljoin(f"{base_url}/", path.lstrip("/"))


def _invoke_legacy_url(
    *,
    method: str,
    url: str,
    headers: Mapping[str, str],
    body: str,
) -> Mapping[str, Any] | None:
    try:
        return http_invoke(
            method=method,
            url=url,
            headers=dict(headers),
            body=body,
            timeout=20,
        )
    except AwsProxyError as exc:
        logger.warning(
            "Legacy proxy request failed via AWS proxy",
            extra={"code": exc.code, "url": url},
        )
        return None


def _normalize_proxy_response(
    *,
    proxy_result: Mapping[str, Any] | None,
    target_path: str,
    event: Mapping[str, Any],
) -> dict[str, Any]:
    if proxy_result is None:
        return json_response(502, {"error": _DEFAULT_ERROR_MESSAGE}, event=event)

    status_code = _safe_status_code(proxy_result.get("status"))
    response_body_raw = proxy_result.get("body")
    parsed_body = _parse_json_object(response_body_raw)
    allowed_success_statuses = _SUCCESS_STATUS_BY_LEGACY_PATH.get(target_path, ())

    if status_code in allowed_success_statuses and parsed_body is not None:
        return json_response(status_code, parsed_body, event=event)
    if status_code in allowed_success_statuses:
        return json_response(status_code, {"message": "Accepted"}, event=event)
    if status_code in _RETRYABLE_STATUS_CODES:
        logger.warning(
            "Legacy upstream retryable failure",
            extra={"status_code": status_code, "path": target_path},
        )
        return json_response(502, {"error": _DEFAULT_ERROR_MESSAGE}, event=event)
    if status_code <= 0:
        return json_response(502, {"error": _DEFAULT_ERROR_MESSAGE}, event=event)

    if parsed_body is not None:
        return json_response(status_code, parsed_body, event=event)
    return json_response(status_code, {"error": _DEFAULT_ERROR_MESSAGE}, event=event)


def _safe_status_code(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _parse_json_object(value: Any) -> dict[str, Any] | None:
    if isinstance(value, Mapping):
        return dict(value)
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, Mapping):
        return dict(parsed)
    return None


def _get_header_case_insensitive(event: Mapping[str, Any], name: str) -> str:
    headers = event.get("headers") or {}
    if not isinstance(headers, Mapping):
        return ""
    target_name = name.lower()
    for key, value in headers.items():
        if str(key).lower() == target_name:
            normalized_value = str(value).strip()
            if normalized_value:
                return normalized_value
            return ""
    return ""
