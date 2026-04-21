"""Lightweight organization picker list for admin UI (excludes vendors)."""

from __future__ import annotations

from typing import Any
from collections.abc import Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import parse_crm_limit
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.engine import get_engine
from app.db.models import Organization, RelationshipType
from app.exceptions import ValidationError
from app.utils import json_response
from app.utils.logging import get_logger

_DEFAULT_LIMIT = 100

logger = get_logger(__name__)


def handle_admin_organizations_picker_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle GET /v1/admin/organizations/picker."""
    logger.info(
        "Handling admin organizations picker route",
        extra={"method": method, "path": path},
    )
    parts = split_route_parts(path)
    if len(parts) < 3 or parts[0] != "admin":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if parts[1] == "organizations" and parts[2] == "picker" and len(parts) == 3:
        return _list_organization_picker(event)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_organization_picker(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = parse_crm_limit(event, default=_DEFAULT_LIMIT)
    with Session(get_engine()) as session:
        statement = (
            select(Organization.id, Organization.name)
            .where(
                Organization.archived_at.is_(None),
                Organization.relationship_type != RelationshipType.VENDOR,
            )
            .order_by(Organization.name.asc(), Organization.id.asc())
            .limit(limit)
        )
        rows = session.execute(statement).all()
        items = [{"id": str(r[0]), "label": r[1]} for r in rows]
        return json_response(200, {"items": items}, event=event)
