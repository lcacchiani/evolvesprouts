"""Public stable share-link route handlers."""

from __future__ import annotations

from typing import Any, Mapping

from sqlalchemy.orm import Session

from app.api.assets.assets_common import (
    generate_download_url,
    signed_link_no_cache_headers,
    split_route_parts,
)
from app.api.assets.share_links import is_valid_share_token
from app.db.engine import get_engine
from app.db.repositories.asset import AssetRepository
from app.utils import json_response


def handle_share_assets_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/assets/share/{token} route."""
    parts = split_route_parts(path)
    if len(parts) != 3 or parts[0] != "assets" or parts[1] != "share":
        return json_response(404, {"error": "Not found"}, event=event)

    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return _resolve_share_token(event, parts[2])


def _resolve_share_token(event: Mapping[str, Any], share_token: str) -> dict[str, Any]:
    if not is_valid_share_token(share_token):
        return json_response(404, {"error": "Not found"}, event=event)

    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        share_link = repository.get_share_link_by_token(token=share_token)
        if share_link is None:
            return json_response(404, {"error": "Not found"}, event=event)

        asset = repository.get_by_id(share_link.asset_id)
        if asset is None:
            return json_response(404, {"error": "Not found"}, event=event)

        download = generate_download_url(s3_key=asset.s3_key)
        response_headers = signed_link_no_cache_headers()
        response_headers["Location"] = download["download_url"]
        return json_response(
            302,
            {},
            headers=response_headers,
            event=event,
        )
