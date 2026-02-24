"""Public asset API handlers."""

from __future__ import annotations

from typing import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import _encode_cursor, _parse_uuid
from app.api.asset_common import (
    generate_download_url,
    parse_cursor,
    parse_limit,
    serialize_asset,
    split_route_parts,
)
from app.db.engine import get_engine
from app.db.models import AssetVisibility
from app.db.repositories.asset import AssetRepository
from app.exceptions import NotFoundError
from app.utils import json_response


def handle_public_assets_request(
    event: Mapping[str, object],
    method: str,
    path: str,
) -> dict[str, object]:
    """Handle /v1/assets/public* routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "assets" or parts[1] != "public":
        return json_response(404, {"error": "Not found"}, event=event)

    if len(parts) == 2 and method == "GET":
        return _list_public_assets(event)

    if len(parts) == 4 and parts[3] == "download" and method == "GET":
        asset_id = _parse_uuid(parts[2])
        return _download_public_asset(event, asset_id)

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _list_public_assets(event: Mapping[str, object]) -> dict[str, object]:
    limit = parse_limit(event)
    cursor = parse_cursor(event)

    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        assets = repository.list_public_assets(limit=limit + 1, cursor=cursor)
        page_items = list(assets[:limit])
        next_cursor = (
            _encode_cursor(page_items[-1].id)
            if len(assets) > limit and page_items
            else None
        )
        return json_response(
            200,
            {
                "items": [serialize_asset(asset) for asset in page_items],
                "next_cursor": next_cursor,
            },
            event=event,
        )


def _download_public_asset(
    event: Mapping[str, object], asset_id: UUID
) -> dict[str, object]:
    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None or asset.visibility != AssetVisibility.PUBLIC:
            raise NotFoundError("Asset", str(asset_id))

        download = generate_download_url(s3_key=asset.s3_key)
        return json_response(200, {"asset_id": str(asset.id), **download}, event=event)
