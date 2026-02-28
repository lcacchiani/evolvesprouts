"""Shared helpers for assets API handlers."""

from __future__ import annotations

import os
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Mapping, Optional, TypeVar
from uuid import UUID, uuid4

from app.api.admin_request import (
    encode_cursor,
    parse_body,
    parse_cursor as parse_admin_cursor,
    query_param,
)
from app.api.admin_validators import validate_string_length
from app.db.models import (
    AccessGrantType,
    Asset,
    AssetAccessGrant,
    AssetType,
    AssetVisibility,
)
from app.exceptions import ValidationError
from app.services.aws_clients import get_s3_client
from app.services.cloudfront_signing import generate_signed_download_url
from app.utils import json_response, require_env

_MAX_FILE_NAME_LENGTH = 255
_MAX_MIME_TYPE_LENGTH = 127
_MAX_PRINCIPAL_ID_LENGTH = 128
_DEFAULT_PRESIGN_TTL_SECONDS = 900
_MIN_PRESIGN_TTL_SECONDS = 60
_MAX_PRESIGN_TTL_SECONDS = 3600
_DEFAULT_DOWNLOAD_LINK_EXPIRY_DAYS = 9999
_MIN_DOWNLOAD_LINK_EXPIRY_DAYS = 1
_MAX_DOWNLOAD_LINK_EXPIRY_DAYS = 36500
_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")
T = TypeVar("T")


@dataclass(frozen=True)
class RequestIdentity:
    """Caller identity extracted from API Gateway authorizer context."""

    user_sub: Optional[str]
    groups: set[str]
    organization_ids: set[str]

    @property
    def is_authenticated(self) -> bool:
        return bool(self.user_sub)

    @property
    def is_admin_or_manager(self) -> bool:
        normalized = {group.lower() for group in self.groups}
        return "admin" in normalized or "manager" in normalized


def normalize_path(path: str) -> str:
    """Normalize route path for deterministic matching."""
    if not path:
        return ""
    normalized = path.strip()
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    if normalized != "/" and normalized.endswith("/"):
        normalized = normalized[:-1]
    return normalized


def split_route_parts(path: str) -> list[str]:
    """Split normalized API route into segments without version prefix."""
    parts = [segment for segment in normalize_path(path).split("/") if segment]
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        return parts[1:]
    return parts


def parse_limit(event: Mapping[str, Any], default: int = 25) -> int:
    """Parse and validate list page size."""
    raw_value = query_param(event, "limit")
    if not raw_value:
        return default
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("limit must be an integer", field="limit") from exc
    if parsed <= 0 or parsed > 100:
        raise ValidationError("limit must be between 1 and 100", field="limit")
    return parsed


def parse_cursor(event: Mapping[str, Any]) -> Optional[UUID]:
    """Parse cursor query parameter."""
    return parse_admin_cursor(query_param(event, "cursor"))


def extract_identity(event: Mapping[str, Any]) -> RequestIdentity:
    """Extract request identity from API Gateway custom authorizer context."""
    request_context = event.get("requestContext")
    if not isinstance(request_context, Mapping):
        return RequestIdentity(user_sub=None, groups=set(), organization_ids=set())
    authorizer = request_context.get("authorizer")
    if not isinstance(authorizer, Mapping):
        return RequestIdentity(user_sub=None, groups=set(), organization_ids=set())

    user_sub = _to_optional_string(
        authorizer.get("userSub")
        or authorizer.get("principalId")
        or _extract_claim(authorizer.get("claims"), "sub")
    )
    groups = _parse_csv_set(
        _to_optional_string(authorizer.get("groups"))
        or _extract_claim(authorizer.get("claims"), "cognito:groups")
    )
    organization_ids = _parse_csv_set(
        _to_optional_string(authorizer.get("organizationIds"))
        or _to_optional_string(authorizer.get("organizationId"))
        or _extract_claim(authorizer.get("claims"), "custom:organization_ids")
        or _extract_claim(authorizer.get("claims"), "custom:organization_id")
        or _extract_claim(authorizer.get("claims"), "organization_ids")
        or _extract_claim(authorizer.get("claims"), "organization_id")
    )
    return RequestIdentity(
        user_sub=user_sub,
        groups=groups,
        organization_ids=organization_ids,
    )


def parse_admin_asset_list_filters(
    event: Mapping[str, Any],
) -> tuple[Optional[str], Optional[AssetVisibility], Optional[AssetType]]:
    """Parse admin list filter query parameters."""
    query = query_param(event, "query")
    query = query.strip() if query else None

    visibility_raw = query_param(event, "visibility")
    visibility: Optional[AssetVisibility] = None
    if visibility_raw:
        visibility = parse_asset_visibility(visibility_raw)

    asset_type_raw = query_param(event, "asset_type")
    asset_type: Optional[AssetType] = None
    if asset_type_raw:
        asset_type = parse_asset_type(asset_type_raw)

    return query, visibility, asset_type


def parse_create_asset_payload(event: Mapping[str, Any]) -> dict[str, Any]:
    """Parse and validate create asset request payload."""
    body = parse_body(event)
    title = _required_text(body, "title", max_length=255)
    description = _optional_text(body, "description", max_length=5000)
    file_name = _required_text(
        body, "file_name", "fileName", max_length=_MAX_FILE_NAME_LENGTH
    )
    asset_type = parse_asset_type(
        _optional_field(body, "asset_type", "assetType") or "document"
    )
    content_type = _optional_text(
        body, "content_type", "contentType", max_length=_MAX_MIME_TYPE_LENGTH
    )
    visibility = parse_asset_visibility(
        _optional_field(body, "visibility") or "restricted"
    )

    return {
        "title": title,
        "description": description,
        "file_name": file_name,
        "asset_type": asset_type,
        "content_type": content_type,
        "visibility": visibility,
    }


def parse_update_asset_payload(event: Mapping[str, Any]) -> dict[str, Any]:
    """Parse and validate update asset request payload.

    For now, update requires the same metadata fields as create to keep request
    handling deterministic and avoid partial-update ambiguity.
    """
    return parse_create_asset_payload(event)


def parse_grant_payload(event: Mapping[str, Any]) -> dict[str, Any]:
    """Parse and validate create grant payload."""
    body = parse_body(event)
    grant_type_raw = _optional_field(body, "grant_type", "grantType")
    if not grant_type_raw:
        raise ValidationError("grant_type is required", field="grant_type")
    grant_type = parse_grant_type(grant_type_raw)

    grantee_id = _optional_text(
        body, "grantee_id", "granteeId", max_length=_MAX_PRINCIPAL_ID_LENGTH
    )
    if grant_type == AccessGrantType.ALL_AUTHENTICATED:
        grantee_id = None
    elif not grantee_id:
        raise ValidationError(
            "grantee_id is required for organization and user grants",
            field="grantee_id",
        )

    return {
        "grant_type": grant_type,
        "grantee_id": grantee_id,
    }


def parse_asset_visibility(value: str) -> AssetVisibility:
    """Parse visibility enum from input."""
    normalized = value.strip().lower()
    try:
        return AssetVisibility(normalized)
    except ValueError as exc:
        raise ValidationError(
            "visibility must be 'public' or 'restricted'", field="visibility"
        ) from exc


def parse_asset_type(value: str) -> AssetType:
    """Parse asset type enum from input."""
    normalized = value.strip().lower()
    try:
        return AssetType(normalized)
    except ValueError as exc:
        raise ValidationError(
            "asset_type must be one of guide, video, pdf, document",
            field="asset_type",
        ) from exc


def parse_grant_type(value: str) -> AccessGrantType:
    """Parse grant type enum from input."""
    normalized = value.strip().lower()
    try:
        return AccessGrantType(normalized)
    except ValueError as exc:
        raise ValidationError(
            "grant_type must be one of all_authenticated, organization, user",
            field="grant_type",
        ) from exc


def paginate_response(
    *,
    items: Sequence[T],
    limit: int,
    event: Mapping[str, Any],
    serializer: Callable[[T], dict[str, Any]],
) -> dict[str, Any]:
    """Build a standard paginated API response payload."""
    page_items = list(items[:limit])
    next_cursor = (
        encode_cursor(page_items[-1].id) if len(items) > limit and page_items else None
    )
    return json_response(
        200,
        {
            "items": [serializer(item) for item in page_items],
            "next_cursor": next_cursor,
        },
        event=event,
    )


def build_s3_key(asset_id: UUID, file_name: str) -> str:
    """Build canonical S3 object key for a new asset."""
    sanitized = sanitize_file_name(file_name)
    return f"assets/{asset_id}/{uuid4()}-{sanitized}"


def sanitize_file_name(file_name: str) -> str:
    """Sanitize filename to safe object-key segment."""
    normalized = file_name.strip()
    if not normalized:
        return "asset"
    cleaned = _FILENAME_SAFE_RE.sub("-", normalized)
    cleaned = cleaned.strip("-")
    return cleaned[:_MAX_FILE_NAME_LENGTH] if cleaned else "asset"


def generate_upload_url(*, s3_key: str, content_type: Optional[str]) -> dict[str, Any]:
    """Generate a presigned PUT URL for upload."""
    bucket_name = _require_assets_bucket_name()
    ttl_seconds = _presign_ttl_seconds()
    s3_client = get_s3_client()

    params: dict[str, Any] = {"Bucket": bucket_name, "Key": s3_key}
    headers: dict[str, str] = {}
    if content_type:
        params["ContentType"] = content_type
        headers["Content-Type"] = content_type

    url = s3_client.generate_presigned_url(
        "put_object",
        Params=params,
        ExpiresIn=ttl_seconds,
        HttpMethod="PUT",
    )
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
    return {
        "upload_url": url,
        "upload_method": "PUT",
        "upload_headers": headers,
        "expires_at": expires_at.isoformat(),
    }


def generate_download_url(*, s3_key: str) -> dict[str, Any]:
    """Generate a CloudFront-signed GET URL for download."""
    expiry_days = _download_link_expiry_days()
    expires_at = datetime.now(UTC) + timedelta(days=expiry_days)
    url = generate_signed_download_url(s3_key=s3_key, expires_at=expires_at)
    return {
        "download_url": url,
        "expires_at": expires_at.isoformat(),
    }


def signed_link_no_cache_headers() -> dict[str, str]:
    """Return headers that force revalidation for signed-link responses."""
    return {
        "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }


def delete_s3_object(*, s3_key: str) -> None:
    """Delete an S3 object by key."""
    bucket_name = _require_assets_bucket_name()
    s3_client = get_s3_client()
    s3_client.delete_object(Bucket=bucket_name, Key=s3_key)


def serialize_asset(asset: Asset) -> dict[str, Any]:
    """Serialize Asset model to API payload."""
    return {
        "id": str(asset.id),
        "title": asset.title,
        "description": asset.description,
        "asset_type": asset.asset_type.value,
        "s3_key": asset.s3_key,
        "file_name": asset.file_name,
        "content_type": asset.content_type,
        "visibility": asset.visibility.value,
        "created_by": asset.created_by,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }


def serialize_grant(grant: AssetAccessGrant) -> dict[str, Any]:
    """Serialize AssetAccessGrant model to API payload."""
    return {
        "id": str(grant.id),
        "asset_id": str(grant.asset_id),
        "grant_type": grant.grant_type.value,
        "grantee_id": grant.grantee_id,
        "granted_by": grant.granted_by,
        "created_at": grant.created_at.isoformat() if grant.created_at else None,
    }


def _require_assets_bucket_name() -> str:
    return require_env("CLIENT_ASSETS_BUCKET_NAME")


def _presign_ttl_seconds() -> int:
    raw = os.getenv(
        "ASSET_PRESIGN_TTL_SECONDS", f"{_DEFAULT_PRESIGN_TTL_SECONDS}"
    ).strip()
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise RuntimeError("ASSET_PRESIGN_TTL_SECONDS must be an integer") from exc
    return max(_MIN_PRESIGN_TTL_SECONDS, min(_MAX_PRESIGN_TTL_SECONDS, parsed))


def _download_link_expiry_days() -> int:
    raw = os.getenv(
        "ASSET_DOWNLOAD_LINK_EXPIRY_DAYS", f"{_DEFAULT_DOWNLOAD_LINK_EXPIRY_DAYS}"
    ).strip()
    try:
        parsed_days = int(raw)
    except ValueError as exc:
        raise RuntimeError(
            "ASSET_DOWNLOAD_LINK_EXPIRY_DAYS must be an integer"
        ) from exc
    return max(
        _MIN_DOWNLOAD_LINK_EXPIRY_DAYS,
        min(_MAX_DOWNLOAD_LINK_EXPIRY_DAYS, parsed_days),
    )


def _required_text(body: Mapping[str, Any], *keys: str, max_length: int) -> str:
    value = _optional_field(body, *keys)
    normalized = validate_string_length(
        value, keys[0], max_length=max_length, required=True
    )
    if normalized is None:
        raise ValidationError(f"{keys[0]} is required", field=keys[0])
    return normalized


def _optional_text(
    body: Mapping[str, Any], *keys: str, max_length: int
) -> Optional[str]:
    value = _optional_field(body, *keys)
    return validate_string_length(value, keys[0], max_length=max_length, required=False)


def _optional_field(body: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in body:
            return body.get(key)
    return None


def _to_optional_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized if normalized else None
    return str(value).strip() or None


def _parse_csv_set(value: Optional[str]) -> set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def _extract_claim(claims: Any, key: str) -> Optional[str]:
    if not isinstance(claims, Mapping):
        return None
    value = claims.get(key)
    if value is None:
        return None
    if isinstance(value, list):
        return ",".join(str(item).strip() for item in value if str(item).strip())
    return _to_optional_string(value)
