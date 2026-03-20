from __future__ import annotations

import io
import json
import logging

from app.utils.logging import StructuredLogFormatter


def test_structured_formatter_merges_logger_extra_into_json() -> None:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(StructuredLogFormatter())
    log = logging.getLogger("test_structured_formatter_extra")
    log.handlers.clear()
    log.propagate = False
    log.addHandler(handler)
    log.setLevel(logging.WARNING)

    log.warning(
        "OpenRouter request failed",
        extra={"status_code": 404, "response_preview": '{"error":"model"}'},
    )

    line = stream.getvalue().strip()
    data = json.loads(line)
    assert data["message"] == "OpenRouter request failed"
    assert data["status_code"] == 404
    assert data["response_preview"] == '{"error":"model"}'
