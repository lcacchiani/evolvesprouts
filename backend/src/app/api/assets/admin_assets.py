"""Admin asset API handlers."""

from __future__ import annotations

from typing import Any, Mapping, Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.api.admin_request import _encode_cursor, _parse_uuid
from app.api.assets.assets_common import (
    build_s3_key,
    delete_s3_object,
    extract_identity,
    generate_upload_url,
    parse_admin_asset_list_filters,
    parse_create_asset_payload,
    parse_cursor,
    parse_grant_payload,
    parse_limit,
    parse_update_asset_payload,
    serialize_asset,
    serialize_grant,
    split_route_parts,
)
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.repositories.asset import AssetRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import get_logger, json_response

logger = get_logger(__name__)


def handle_admin_assets_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/assets* routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "assets":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_assets(event)
        if method == "POST":
            return _create_asset(event, identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    asset_id = _parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_asset(event, asset_id)
        if method == "PUT":
            return _update_asset(event, asset_id)
        if method == "DELETE":
            return _delete_asset(event, asset_id)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 4 and parts[3] == "grants":
        if method == "GET":
            return _list_grants(event, asset_id)
        if method == "POST":
            return _create_grant(event, asset_id, identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 5 and parts[3] == "grants" and method == "DELETE":
        grant_id = _parse_uuid(parts[4])
        return _delete_grant(event, asset_id, grant_id)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_assets(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = parse_limit(event)
    cursor = parse_cursor(event)
    query, visibility, asset_type = parse_admin_asset_list_filters(event)

    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        assets = repository.list_assets(
            limit=limit + 1,
            cursor=cursor,
            query=query,
            visibility=visibility,
            asset_type=asset_type,
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


def _create_asset(event: Mapping[str, Any], created_by: str) -> dict[str, Any]:
    payload = parse_create_asset_payload(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=created_by, request_id=request_id)
        repository = AssetRepository(session)

        asset_id = uuid4()
        s3_key = build_s3_key(asset_id, payload["file_name"])

        asset = repository.create_asset(
            asset_id=asset_id,
            title=payload["title"],
            description=payload["description"],
            asset_type=payload["asset_type"],
            s3_key=s3_key,
            file_name=payload["file_name"],
            file_size_bytes=payload["file_size_bytes"],
            content_type=payload["content_type"],
            visibility=payload["visibility"],
            organization_id=payload["organization_id"],
            created_by=created_by,
        )
        upload = generate_upload_url(
            s3_key=s3_key, content_type=payload["content_type"]
        )
        session.commit()

        return json_response(
            201,
            {"asset": serialize_asset(asset), **upload},
            event=event,
        )


def _get_asset(event: Mapping[str, Any], asset_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))
        return json_response(200, {"asset": serialize_asset(asset)}, event=event)


def _update_asset(event: Mapping[str, Any], asset_id: UUID) -> dict[str, Any]:
    payload = parse_update_asset_payload(event)
    identity = extract_identity(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(
            session, user_id=identity.user_sub or "", request_id=request_id
        )
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))

        updated = repository.update_asset(
            asset,
            title=payload["title"],
            description=payload["description"],
            asset_type=payload["asset_type"],
            file_name=payload["file_name"],
            file_size_bytes=payload["file_size_bytes"],
            content_type=payload["content_type"],
            visibility=payload["visibility"],
            organization_id=payload["organization_id"],
        )
        session.commit()
        return json_response(200, {"asset": serialize_asset(updated)}, event=event)


def _delete_asset(event: Mapping[str, Any], asset_id: UUID) -> dict[str, Any]:
    identity = extract_identity(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(
            session, user_id=identity.user_sub or "", request_id=request_id
        )
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))

        delete_s3_object(s3_key=asset.s3_key)
        repository.delete(asset)
        session.commit()
        return json_response(204, {}, event=event)


def _list_grants(event: Mapping[str, Any], asset_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))
        grants = repository.list_grants(asset_id=asset_id)
        return json_response(
            200,
            {"items": [serialize_grant(grant) for grant in grants]},
            event=event,
        )


def _create_grant(
    event: Mapping[str, Any],
    asset_id: UUID,
    granted_by: str,
) -> dict[str, Any]:
    payload = parse_grant_payload(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=granted_by, request_id=request_id)
        repository = AssetRepository(session)
        asset = repository.get_by_id(asset_id)
        if asset is None:
            raise NotFoundError("Asset", str(asset_id))

        existing = repository.find_matching_grant(
            asset_id=asset_id,
            grant_type=payload["grant_type"],
            grantee_id=payload["grantee_id"],
        )
        if existing:
            raise ValidationError("Grant already exists", field="grant_type")

        grant = repository.create_grant(
            asset_id=asset_id,
            grant_type=payload["grant_type"],
            grantee_id=payload["grantee_id"],
            granted_by=granted_by,
        )
        session.commit()
        return json_response(201, {"grant": serialize_grant(grant)}, event=event)


def _delete_grant(
    event: Mapping[str, Any],
    asset_id: UUID,
    grant_id: UUID,
) -> dict[str, Any]:
    identity = extract_identity(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(
            session, user_id=identity.user_sub or "", request_id=request_id
        )
        repository = AssetRepository(session)
        grant = repository.get_grant(asset_id=asset_id, grant_id=grant_id)
        if grant is None:
            raise NotFoundError("Grant", str(grant_id))

        repository.delete_grant(grant)
        session.commit()
        return json_response(204, {}, event=event)


def _request_id(event: Mapping[str, Any]) -> Optional[str]:
    request_context = event.get("requestContext")
    if not isinstance(request_context, Mapping):
        return None
    request_id = request_context.get("requestId")
    if isinstance(request_id, str):
        return request_id
    return None
