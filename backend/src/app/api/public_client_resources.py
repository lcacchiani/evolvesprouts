"""Public client resources feed for the website."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy.orm import Session

from app.api.admin_request import query_param
from app.api.assets.assets_common import (
    normalize_path,
    paginate_response,
    parse_content_language_query_param,
    parse_cursor,
    parse_limit,
    serialize_public_client_resource,
)
from app.db.engine import get_engine
from app.db.repositories.asset import AssetRepository
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _is_free_assets_list_path(path: str) -> bool:
    """True for /v1/assets/free and /www/v1/assets/free (normalized path)."""
    parts = [segment for segment in normalize_path(path).split("/") if segment]
    if len(parts) == 3:
        return parts[0] == "v1" and parts[1] == "assets" and parts[2] == "free"
    if len(parts) == 4:
        return (
            parts[0] == "www"
            and parts[1] == "v1"
            and parts[2] == "assets"
            and parts[3] == "free"
        )
    return False


def handle_public_client_resources_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle GET /v1/assets/free and /www/v1/assets/free."""
    if not _is_free_assets_list_path(path):
        return json_response(404, {"error": "Not found"}, event=event)

    logger.info(
        "Handling public client resources request",
        extra={"method": method, "path": path},
    )
    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    limit = parse_limit(event)
    cursor = parse_cursor(event)
    language = parse_content_language_query_param(query_param(event, "language"))

    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        rows = repository.list_client_public_resources(
            limit=limit + 1,
            cursor=cursor,
            language=language,
        )
    return paginate_response(
        items=rows,
        limit=limit,
        event=event,
        serializer=serialize_public_client_resource,
    )
