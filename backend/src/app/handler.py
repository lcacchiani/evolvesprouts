"""Lambda handler utilities and decorators for consistent error handling."""

from __future__ import annotations

import functools
import logging
import traceback
from typing import Any, Callable, Dict, Optional, TypeVar

from app.errors import ApiError, internal_error
from app.http import error_response, json_response

# Configure logging for Lambda environment
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Type variable for handler return type
T = TypeVar('T')

# Type alias for Lambda handler function
HandlerFunc = Callable[[Dict[str, Any], Any], Dict[str, Any]]


def lambda_handler(
    *,
    log_request: bool = True,
    log_response: bool = False,
) -> Callable[[HandlerFunc], HandlerFunc]:
    """Decorator for Lambda handlers with consistent error handling and logging.

    Wraps a handler function to provide:
    - Automatic ApiError to HTTP response conversion
    - Generic exception handling with logging
    - Optional request/response logging

    Args:
        log_request: If True, log incoming event details. Default True.
        log_response: If True, log outgoing response. Default False.

    Returns:
        Decorator function.

    Example:
        @lambda_handler()
        def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
            # Handler logic here
            return json_response(200, {'data': result})
    """
    def decorator(func: HandlerFunc) -> HandlerFunc:
        @functools.wraps(func)
        def wrapper(
            event: Dict[str, Any],
            context: Any,
        ) -> Dict[str, Any]:
            request_id = _get_request_id(event, context)

            if log_request:
                _log_request(event, request_id)

            try:
                response = func(event, context)
                if log_response:
                    logger.info(
                        'Response: status=%s request_id=%s',
                        response.get('statusCode'),
                        request_id,
                    )
                return response
            except ApiError as exc:
                logger.warning(
                    'API error: status=%d message=%s request_id=%s',
                    exc.status_code,
                    exc.message,
                    request_id,
                )
                return error_response(exc)
            except Exception as exc:
                logger.error(
                    'Unhandled exception: %s request_id=%s\n%s',
                    str(exc),
                    request_id,
                    traceback.format_exc(),
                )
                return error_response(internal_error())

        return wrapper
    return decorator


def _get_request_id(event: Dict[str, Any], context: Any) -> str:
    """Extract request ID from event or context."""
    # Try API Gateway request ID first
    request_context = event.get('requestContext') or {}
    request_id = request_context.get('requestId')
    if request_id:
        return request_id

    # Fall back to Lambda request ID
    if context and hasattr(context, 'aws_request_id'):
        return context.aws_request_id

    return 'unknown'


def _log_request(event: Dict[str, Any], request_id: str) -> None:
    """Log incoming request details."""
    request_context = event.get('requestContext') or {}
    http_info = request_context.get('http') or {}
    method = http_info.get('method', 'UNKNOWN')
    path = http_info.get('path', '/')

    logger.info(
        'Request: method=%s path=%s request_id=%s',
        method,
        path,
        request_id,
    )


def success_response(
    data: Dict[str, Any],
    status_code: int = 200,
) -> Dict[str, Any]:
    """Create a successful JSON response.

    Args:
        data: Response body data.
        status_code: HTTP status code. Default 200.

    Returns:
        API Gateway response dictionary.
    """
    return json_response(status_code, data)


def created_response(
    data: Dict[str, Any],
    location: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a 201 Created response.

    Args:
        data: Response body data.
        location: Optional Location header value.

    Returns:
        API Gateway response dictionary.
    """
    response = json_response(201, data)
    if location:
        response['headers'] = {
            **response.get('headers', {}),
            'location': location,
        }
    return response


def no_content_response() -> Dict[str, Any]:
    """Create a 204 No Content response.

    Returns:
        API Gateway response dictionary with no body.
    """
    return {
        'statusCode': 204,
        'headers': {},
        'body': '',
    }
