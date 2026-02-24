"""Admin Lambda API entrypoint.

This handler currently keeps only the public reservation dispatch path.
Other legacy admin/manager/user CRUD routes were intentionally removed from
this module and now return `404 Not found`.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.api.public_reservations import _handle_public_reservation
from app.exceptions import ValidationError
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

    return json_response(404, {"error": "Not found"}, event=event)


def _safe_handler(
    handler: Any,
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Execute a handler with common error handling."""
    try:
        return handler()
    except ValidationError as exc:
        logger.warning(f"Validation error: {exc.message}")
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
