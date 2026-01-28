"""Lambda handler utilities and decorators for consistent error handling.

Performance notes:
- Logging uses isEnabledFor() checks to avoid string formatting overhead
- traceback.format_exc() only called for ERROR level exceptions
- Request ID extraction is optimized with early returns
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable, Dict, Optional, TypeVar

from app.errors import ApiError, internal_error
from app.http import error_response, json_response

# Configure logging for Lambda environment
logger = logging.getLogger(__name__)

# Pre-compute log level checks (these are module-level constants after init)
_LOG_INFO_ENABLED: bool = True  # Will be checked at runtime
_LOG_WARNING_ENABLED: bool = True
_LOG_ERROR_ENABLED: bool = True

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
            # Only compute request_id if we need it for logging
            request_id: Optional[str] = None

            if log_request and logger.isEnabledFor(logging.INFO):
                request_id = _get_request_id(event, context)
                _log_request(event, request_id)

            try:
                response = func(event, context)
                if log_response and logger.isEnabledFor(logging.INFO):
                    if request_id is None:
                        request_id = _get_request_id(event, context)
                    logger.info(
                        'Response: status=%s request_id=%s',
                        response.get('statusCode'),
                        request_id,
                    )
                return response
            except ApiError as exc:
                if logger.isEnabledFor(logging.WARNING):
                    if request_id is None:
                        request_id = _get_request_id(event, context)
                    logger.warning(
                        'API error: status=%d message=%s request_id=%s',
                        exc.status_code,
                        exc.message,
                        request_id,
                    )
                return error_response(exc)
            except Exception as exc:
                if logger.isEnabledFor(logging.ERROR):
                    if request_id is None:
                        request_id = _get_request_id(event, context)
                    # Only import traceback when we actually need it
                    import traceback
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
    """Extract request ID from event or context (optimized with early returns)."""
    # Fast path: Try API Gateway request ID first (most common case)
    request_context = event.get('requestContext')
    if request_context:
        request_id = request_context.get('requestId')
        if request_id:
            return request_id

    # Fall back to Lambda request ID
    if context is not None:
        aws_request_id = getattr(context, 'aws_request_id', None)
        if aws_request_id:
            return aws_request_id

    return 'unknown'


def _log_request(event: Dict[str, Any], request_id: str) -> None:
    """Log incoming request details (only called when INFO is enabled)."""
    request_context = event.get('requestContext')
    if request_context:
        http_info = request_context.get('http')
        if http_info:
            logger.info(
                'Request: method=%s path=%s request_id=%s',
                http_info.get('method', 'UNKNOWN'),
                http_info.get('path', '/'),
                request_id,
            )
            return

    # Fallback for non-HTTP API Gateway events
    logger.info('Request: request_id=%s', request_id)


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
