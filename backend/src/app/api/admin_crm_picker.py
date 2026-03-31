"""Lightweight CRM picker lists for admin UI (families, organisations)."""

from __future__ import annotations

from typing import Any
from collections.abc import Mapping
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import parse_crm_limit
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.engine import get_engine
from app.db.models import Family, Organization, RelationshipType
from app.exceptions import ValidationError
from app.utils import json_response

_DEFAULT_LIMIT = 100


def handle_admin_crm_picker_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle GET /v1/admin/families/picker and GET /v1/admin/organizations/picker."""
    parts = split_route_parts(path)
    if len(parts) < 3 or parts[0] != "admin":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if parts[1] == "families" and parts[2] == "picker" and len(parts) == 3:
        return _list_family_picker(event)
    if parts[1] == "organizations" and parts[2] == "picker" and len(parts) == 3:
        return _list_organization_picker(event)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_family_picker(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = parse_crm_limit(event, default=_DEFAULT_LIMIT)
    with Session(get_engine()) as session:
        statement = (
            select(Family.id, Family.family_name)
            .where(Family.archived_at.is_(None))
            .order_by(Family.family_name.asc(), Family.id.asc())
            .limit(limit)
        )
        rows = session.execute(statement).all()
        items = [{"id": str(r[0]), "label": r[1]} for r in rows]
        return json_response(200, {"items": items}, event=event)


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
