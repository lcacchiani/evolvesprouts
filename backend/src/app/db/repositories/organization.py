"""Repository for organization entities."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Organization, RelationshipType
from app.db.repositories.base import BaseRepository


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters."""
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _normalize_vendor_match_name(parsed_vendor_name: str) -> str:
    """Normalize parser output for vendor matching (trim, collapse whitespace)."""
    return re.sub(r"\s+", " ", parsed_vendor_name.strip())


class OrganizationRepository(BaseRepository[Organization]):
    """Repository helpers for organization records."""

    def __init__(self, session: Session):
        super().__init__(session, Organization)

    def list_vendors(
        self,
        *,
        limit: int,
        cursor: UUID | None = None,
        query: str | None = None,
        active: bool | None = None,
    ) -> list[Organization]:
        """List organizations scoped to vendor relationship type."""
        statement = select(Organization).where(
            Organization.relationship_type == RelationshipType.VENDOR
        )
        if cursor is not None:
            cursor_created_at = (
                select(Organization.created_at)
                .where(Organization.id == cursor)
                .scalar_subquery()
            )
            statement = statement.where(
                or_(
                    Organization.created_at < cursor_created_at,
                    and_(
                        Organization.created_at == cursor_created_at,
                        Organization.id < cursor,
                    ),
                )
            )
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(Organization.name.ilike(pattern, escape="\\"))
        if active is True:
            statement = statement.where(Organization.archived_at.is_(None))
        if active is False:
            statement = statement.where(Organization.archived_at.is_not(None))
        statement = statement.order_by(
            Organization.created_at.desc(),
            Organization.id.desc(),
        ).limit(limit)
        return list(self._session.execute(statement).scalars().all())

    def count_vendors(
        self,
        *,
        query: str | None = None,
        active: bool | None = None,
    ) -> int:
        """Count vendor organizations with the same filters used by list."""
        statement = select(func.count(Organization.id)).where(
            Organization.relationship_type == RelationshipType.VENDOR
        )
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(Organization.name.ilike(pattern, escape="\\"))
        if active is True:
            statement = statement.where(Organization.archived_at.is_(None))
        if active is False:
            statement = statement.where(Organization.archived_at.is_not(None))
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def get_vendor_by_id(self, vendor_id: UUID) -> Organization | None:
        """Return one organization only when it is a vendor."""
        statement = select(Organization).where(
            Organization.id == vendor_id,
            Organization.relationship_type == RelationshipType.VENDOR,
        )
        return self._session.execute(statement).scalar_one_or_none()

    def try_resolve_active_vendor_by_parsed_name(
        self, parsed_vendor_name: str
    ) -> Organization | None:
        """Match parsed invoice vendor text to at most one active vendor org.

        Tier 1: case-insensitive equality on trimmed names.
        Tier 2: single ILIKE substring match among active vendors only.
        Returns None when ambiguous or unmatched.
        """
        normalized = _normalize_vendor_match_name(parsed_vendor_name)
        if not normalized:
            return None

        exact_stmt = (
            select(Organization)
            .where(
                Organization.relationship_type == RelationshipType.VENDOR,
                Organization.archived_at.is_(None),
                func.lower(func.trim(Organization.name)) == normalized.lower(),
            )
            .limit(2)
        )
        exact_hits = list(self._session.execute(exact_stmt).scalars().all())
        if len(exact_hits) == 1:
            return exact_hits[0]
        if len(exact_hits) > 1:
            return None

        escaped = _escape_like_pattern(normalized)
        pattern = f"%{escaped}%"
        fuzzy_stmt = (
            select(Organization)
            .where(
                Organization.relationship_type == RelationshipType.VENDOR,
                Organization.archived_at.is_(None),
                Organization.name.ilike(pattern, escape="\\"),
            )
            .limit(2)
        )
        fuzzy_hits = list(self._session.execute(fuzzy_stmt).scalars().all())
        if len(fuzzy_hits) == 1:
            return fuzzy_hits[0]
        return None
