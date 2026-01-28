"""API error types for consistent error handling.

This module defines the ApiError exception class and factory functions
for common HTTP error responses. All API errors can be converted to
HTTP responses using the error_response() function in http.py.

Usage:
    from app.errors import bad_request, not_found

    def get_item(item_id: str):
        item = db.get(item_id)
        if not item:
            raise not_found('item_not_found')
        return item
"""

from __future__ import annotations


class ApiError(Exception):
    """Exception representing an API error response.

    Attributes:
        status_code: HTTP status code for the error.
        message: Error message code (not user-facing text).
    """

    def __init__(self, status_code: int, message: str) -> None:
        """Initialize an API error.

        Args:
            status_code: HTTP status code (e.g., 400, 404, 500).
            message: Error message code for client handling.
        """
        super().__init__(message)
        self.status_code = status_code
        self.message = message

    def __repr__(self) -> str:
        return f'ApiError(status_code={self.status_code}, message={self.message!r})'


def bad_request(message: str = 'bad_request') -> ApiError:
    """Create a 400 Bad Request error.

    Args:
        message: Error message code. Default: 'bad_request'.

    Returns:
        ApiError with status code 400.
    """
    return ApiError(400, message)


def unauthorized(message: str = 'unauthorized') -> ApiError:
    """Create a 401 Unauthorized error.

    Args:
        message: Error message code. Default: 'unauthorized'.

    Returns:
        ApiError with status code 401.
    """
    return ApiError(401, message)


def forbidden(message: str = 'forbidden') -> ApiError:
    """Create a 403 Forbidden error.

    Args:
        message: Error message code. Default: 'forbidden'.

    Returns:
        ApiError with status code 403.
    """
    return ApiError(403, message)


def not_found(message: str = 'not_found') -> ApiError:
    """Create a 404 Not Found error.

    Args:
        message: Error message code. Default: 'not_found'.

    Returns:
        ApiError with status code 404.
    """
    return ApiError(404, message)


def conflict(message: str = 'conflict') -> ApiError:
    """Create a 409 Conflict error.

    Args:
        message: Error message code. Default: 'conflict'.

    Returns:
        ApiError with status code 409.
    """
    return ApiError(409, message)


def internal_error(message: str = 'internal_error') -> ApiError:
    """Create a 500 Internal Server Error.

    Args:
        message: Error message code. Default: 'internal_error'.

    Returns:
        ApiError with status code 500.
    """
    return ApiError(500, message)


def service_unavailable(message: str = 'service_unavailable') -> ApiError:
    """Create a 503 Service Unavailable error.

    Args:
        message: Error message code. Default: 'service_unavailable'.

    Returns:
        ApiError with status code 503.
    """
    return ApiError(503, message)
