"""Repository for organization entities."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Organization, RelationshipType
from app.db.repositories.base import BaseRepository


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters."""
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


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
