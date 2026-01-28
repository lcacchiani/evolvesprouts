class ApiError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def bad_request(message: str = 'bad_request') -> ApiError:
    return ApiError(400, message)


def unauthorized(message: str = 'unauthorized') -> ApiError:
    return ApiError(401, message)


def forbidden(message: str = 'forbidden') -> ApiError:
    return ApiError(403, message)


def not_found(message: str = 'not_found') -> ApiError:
    return ApiError(404, message)


def internal_error(message: str = 'internal_error') -> ApiError:
    return ApiError(500, message)
