"""Authenticated user asset API handlers."""

from __future__ import annotations

from typing import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import _encode_cursor, _parse_uuid
from app.api.assets.assets_common import (
    RequestIdentity,
    extract_identity,
    generate_download_url,
    parse_cursor,
    parse_limit,
    serialize_asset,
    split_route_parts,
)
from app.db.engine import get_engine
from app.db.repositories.asset import AssetRepository
from app.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.utils import json_response


def handle_user_assets_request(
    event: Mapping[str, object],
    method: str,
    path: str,
) -> dict[str, object]:
    """Handle /v1/user/assets* routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "user" or parts[1] != "assets":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2 and method == "GET":
        return _list_accessible_assets(event, identity)

    if len(parts) == 4 and parts[3] == "download" and method == "GET":
        asset_id = _parse_uuid(parts[2])
        return _download_asset(event, asset_id, identity)

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _list_accessible_assets(
    event: Mapping[str, object], identity: RequestIdentity
) -> dict[str, object]:
    limit = parse_limit(event)
    cursor = parse_cursor(event)

    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        assets = repository.list_accessible_assets(
            user_sub=identity.user_sub,
            organization_ids=identity.organization_ids,
            is_admin_or_manager=identity.is_admin_or_manager,
            limit=limit + 1,
            cursor=cursor,
        )
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


def _download_asset(
    event: Mapping[str, object],
    asset_id: UUID,
    identity: RequestIdentity,
) -> dict[str, object]:
    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))

        can_access = repository.can_access_asset(
            asset=asset,
            user_sub=identity.user_sub,
            organization_ids=identity.organization_ids,
            is_admin_or_manager=identity.is_admin_or_manager,
            is_authenticated=identity.is_authenticated,
        )
        if not can_access:
            raise AuthorizationError("Access denied for this asset")

        download = generate_download_url(s3_key=asset.s3_key)
        return json_response(200, {"asset_id": str(asset.id), **download}, event=event)
