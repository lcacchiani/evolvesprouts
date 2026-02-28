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
from app.api.public_reservations import _handle_public_reservation
from app.exceptions import AppError, ValidationError
from app.utils import json_response
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.responses import validate_content_type

configure_logging()
logger = get_logger(__name__)

__all__ = ["lambda_handler"]
RouteFactory = Callable[[Mapping[str, Any], str, str], Callable[[], dict[str, Any]]]


def _reservation_factory(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Callable[[], dict[str, Any]]:
    del path
    return lambda: _handle_public_reservation(event, method)


def _admin_assets_factory(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Callable[[], dict[str, Any]]:
    return lambda: handle_admin_assets_request(event, method, path)


def _user_assets_factory(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Callable[[], dict[str, Any]]:
    return lambda: handle_user_assets_request(event, method, path)


def _share_assets_factory(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Callable[[], dict[str, Any]]:
    return lambda: handle_share_assets_request(event, method, path)


def _public_assets_factory(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Callable[[], dict[str, Any]]:
    return lambda: handle_public_assets_request(event, method, path)


_ROUTES: tuple[tuple[str, bool, RouteFactory], ...] = (
    ("/v1/reservations", True, _reservation_factory),
    ("/www/v1/reservations", True, _reservation_factory),
    ("/v1/admin/assets", False, _admin_assets_factory),
    ("/v1/user/assets", False, _user_assets_factory),
    ("/v1/assets/share", False, _share_assets_factory),
    ("/v1/assets/public", False, _public_assets_factory),
)


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

    handler = _match_handler(event=event, method=method, path=path)
    if handler is not None:
        return _safe_handler(handler, event)

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
        return json_response(500, {"error": "Internal server error"}, event=event)


def _match_handler(
    *,
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> Any:
    """Return the request handler for a known route, if any."""
    normalized_path = path.rstrip("/")
    for route_path, exact, route_factory in _ROUTES:
        if _path_matches(normalized_path, route_path, exact=exact):
            return route_factory(event, method, normalized_path)
    return None


def _path_matches(path: str, route_path: str, *, exact: bool) -> bool:
    """Return whether a path matches a route path."""
    if exact:
        return path == route_path
    return path == route_path or path.startswith(route_path + "/")
