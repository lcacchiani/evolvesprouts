from __future__ import annotations

import json

from app.api.admin import _safe_handler


def test_safe_handler_hides_internal_exception_details() -> None:
    event = {"headers": {}}

    response = _safe_handler(lambda: (_ for _ in ()).throw(RuntimeError("db leaked")), event)

    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert body == {"error": "Internal server error"}
    assert "detail" not in body
