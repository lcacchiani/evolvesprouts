"""Admin Lambda API entrypoint."""

from __future__ import annotations

from typing import Any
from collections.abc import Callable, Mapping

from app.api.assets import (
    handle_admin_assets_request,
    handle_public_assets_request,
    handle_share_assets_request,
    handle_user_assets_request,
)
from app.api.public_free_guide import handle_free_guide_request
from app.api.public_reservations import _handle_public_reservation
from app.exceptions import AppError, ValidationError
from app.utils import json_response
from app.utils.logging import (
    clear_request_context,
    configure_logging,
    get_logger,
    set_request_context,
)
from app.utils.responses import validate_content_type

configure_logging()
logger = get_logger(__name__)

__all__ = ["lambda_handler"]

_ROUTES: tuple[
    tuple[str, bool, Callable[[Mapping[str, Any], str, str], dict[str, Any]]],
    ...,
] = (
    (
        "/v1/reservations",
        True,
        lambda event, method, _path: _handle_public_reservation(event, method),
    ),
    (
        "/www/v1/reservations",
        True,
        lambda event, method, _path: _handle_public_reservation(event, method),
    ),
    (
        "/v1/free-guide-request",
        True,
        lambda event, method, _path: handle_free_guide_request(event, method),
    ),
    ("/v1/admin/assets", False, handle_admin_assets_request),
    ("/v1/user/assets", False, handle_user_assets_request),
    ("/v1/assets/share", False, handle_share_assets_request),
    ("/v1/assets/public", False, handle_public_assets_request),
)


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle requests routed to the admin Lambda."""
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)
    try:
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

        handler = _match_handler(event=event, method=method, path=path)
        if handler is not None:
            return _safe_handler(handler, event)

        return json_response(404, {"error": "Not found"}, event=event)
    finally:
        clear_request_context()


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
    except Exception:  # pragma: no cover
        logger.exception("Unexpected error in handler")
        return json_response(500, {"error": "Internal server error"}, event=event)


def _match_handler(
    *,
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Any:
    """Return the request handler for a known route, if any."""
    normalized_path = path.rstrip("/")
    for route_path, exact, route_handler in _ROUTES:
        if _path_matches(normalized_path, route_path, exact=exact):
            return lambda handler=route_handler: handler(event, method, normalized_path)
    return None


def _path_matches(path: str, route_path: str, *, exact: bool) -> bool:
    """Return whether a path matches a route path."""
    if exact:
        return path == route_path
    return path == route_path or path.startswith(route_path + "/")
