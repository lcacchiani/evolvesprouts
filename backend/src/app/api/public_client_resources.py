"""Public client resources feed for the website."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy.orm import Session

from app.api.admin_request import query_param
from app.api.assets.assets_common import (
    paginate_response,
    parse_content_language_query_param,
    parse_cursor,
    parse_limit,
    serialize_public_client_resource,
    split_route_parts,
)
from app.db.engine import get_engine
from app.db.repositories.asset import AssetRepository
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def handle_public_client_resources_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle GET /v1/client-resources and /www/v1/client-resources."""
    parts = split_route_parts(path)
    if len(parts) != 1 or parts[0] != "client-resources":
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
