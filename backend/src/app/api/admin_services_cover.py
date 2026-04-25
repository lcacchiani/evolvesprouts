"""Admin service cover image presign helpers."""

from __future__ import annotations

import os
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.api.admin_request import parse_body
from app.api.admin_services_common import request_id
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.repositories import ServiceRepository
from app.exceptions import NotFoundError, ValidationError
from app.services.aws_clients import get_s3_client
from app.utils import json_response, require_env
from app.utils.logging import get_logger

logger = get_logger(__name__)


def create_cover_image_upload(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    file_name = str(body.get("file_name") or "").strip()
    if not file_name:
        raise ValidationError("file_name is required", field="file_name")
    content_type = (
        str(body.get("content_type") or "").strip() or "application/octet-stream"
    )
    normalized_file_name = _sanitize_file_name(file_name)
    s3_key = f"media/services/{service_id}/cover/{uuid4()}-{normalized_file_name}"
    logger.info(
        "Creating service cover image upload URL",
        extra={"service_id": str(service_id), "actor_sub": actor_sub},
    )

    media_bucket = require_env("ASSETS_BUCKET_NAME")
    ttl = _presign_ttl_seconds()
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl)
    s3_client = get_s3_client()
    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": media_bucket,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=ttl,
        HttpMethod="PUT",
    )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ServiceRepository(session)
        service = repository.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))
        service.cover_image_s3_key = s3_key
        repository.update_service(service)
        session.commit()

    return json_response(
        200,
        {
            "upload_url": upload_url,
            "upload_method": "PUT",
            "upload_headers": {"Content-Type": content_type},
            "s3_key": s3_key,
            "expires_at": expires_at.isoformat(),
            "service": {"id": str(service_id), "cover_image_s3_key": s3_key},
        },
        event=event,
    )


def _sanitize_file_name(file_name: str) -> str:
    safe = "".join(
        char if char.isalnum() or char in {".", "-", "_"} else "-"
        for char in file_name.strip()
    )
    safe = safe.strip("-")
    return safe or "cover-image"


def _presign_ttl_seconds() -> int:
    raw = os.getenv("ASSET_PRESIGN_TTL_SECONDS", "900").strip()
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise ValidationError("ASSET_PRESIGN_TTL_SECONDS must be an integer") from exc
    return max(60, min(3600, parsed))
