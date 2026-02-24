"""Admin Lambda API entrypoint."""

from __future__ import annotations

from typing import Any, Mapping

from app.api.admin_assets import handle_admin_assets_request
from app.api.public_assets import handle_public_assets_request
from app.api.public_reservations import _handle_public_reservation
from app.api.user_assets import handle_user_assets_request
from app.exceptions import AppError, ValidationError
from app.utils import json_response
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.responses import validate_content_type

configure_logging()
logger = get_logger(__name__)

__all__ = ["lambda_handler"]


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle requests routed to the admin Lambda."""
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)

    method = event.get("httpMethod", "")
    path = event.get("path", "")

    try:
        validate_content_type(event)
    except ValidationError as exc:
        logger.warning(f"Content-Type validation failed: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)

    logger.info(
        f"Admin request: {method} {path}",
        extra={
            "path": path,
            "method": method,
        },
    )

    if _is_public_reservation_path(path):
        return _safe_handler(
            lambda: _handle_public_reservation(event, method),
            event,
        )
    if _is_admin_assets_path(path):
        return _safe_handler(
            lambda: handle_admin_assets_request(event, method, path),
            event,
        )
    if _is_user_assets_path(path):
        return _safe_handler(
            lambda: handle_user_assets_request(event, method, path),
            event,
        )
    if _is_public_assets_path(path):
        return _safe_handler(
            lambda: handle_public_assets_request(event, method, path),
            event,
        )

    return json_response(404, {"error": "Not found"}, event=event)


def _safe_handler(
    handler: Any,
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Execute a handler with common error handling."""
    try:
        return handler()
    except AppError as exc:
        logger.warning(f"Application error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except ValueError as exc:
        logger.warning(f"Value error: {exc}")
        return json_response(400, {"error": str(exc)}, event=event)
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected error in handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


def _is_public_reservation_path(path: str) -> bool:
    """Return whether the request targets the public reservations endpoint."""
    normalized_path = path.rstrip("/")
    return normalized_path in ("/v1/reservations", "/www/v1/reservations")


def _is_admin_assets_path(path: str) -> bool:
    """Return whether the path targets /v1/admin/assets routes."""
    normalized_path = path.rstrip("/")
    return normalized_path == "/v1/admin/assets" or normalized_path.startswith(
        "/v1/admin/assets/"
    )


def _is_user_assets_path(path: str) -> bool:
    """Return whether the path targets /v1/user/assets routes."""
    normalized_path = path.rstrip("/")
    return normalized_path == "/v1/user/assets" or normalized_path.startswith(
        "/v1/user/assets/"
    )


def _is_public_assets_path(path: str) -> bool:
    """Return whether the path targets /v1/assets/public routes."""
    normalized_path = path.rstrip("/")
    return normalized_path == "/v1/assets/public" or normalized_path.startswith(
        "/v1/assets/public/"
    )
