"""Repository for CRM family entities."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Family
from app.db.models.family import FamilyMember
from app.db.models.tag import FamilyTag
from app.db.repositories.base import BaseRepository
from app.db.repositories.organization import _escape_like_pattern


class FamilyRepository(BaseRepository[Family]):
    """List and load families for admin CRM."""

    def __init__(self, session: Session):
        super().__init__(session, Family)

    def list_for_admin(
        self,
        *,
        limit: int,
        cursor: UUID | None = None,
        query: str | None = None,
        active: bool | None = None,
    ) -> list[Family]:
        statement = select(Family).options(
            selectinload(Family.family_tags).selectinload(FamilyTag.tag),
            selectinload(Family.family_members).selectinload(FamilyMember.contact),
        )
        if cursor is not None:
            cursor_created_at = (
                select(Family.created_at).where(Family.id == cursor).scalar_subquery()
            )
            statement = statement.where(
                or_(
                    Family.created_at < cursor_created_at,
                    and_(
                        Family.created_at == cursor_created_at,
                        Family.id < cursor,
                    ),
                )
            )
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(Family.family_name.ilike(pattern, escape="\\"))
        if active is True:
            statement = statement.where(Family.archived_at.is_(None))
        if active is False:
            statement = statement.where(Family.archived_at.is_not(None))
        statement = statement.order_by(
            Family.created_at.desc(),
            Family.id.desc(),
        ).limit(limit)
        return list(self._session.execute(statement).scalars().unique().all())

    def count_for_admin(
        self,
        *,
        query: str | None = None,
        active: bool | None = None,
    ) -> int:
        statement = select(func.count(Family.id))
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(Family.family_name.ilike(pattern, escape="\\"))
        if active is True:
            statement = statement.where(Family.archived_at.is_(None))
        if active is False:
            statement = statement.where(Family.archived_at.is_not(None))
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def get_by_id_for_admin(self, family_id: UUID) -> Family | None:
        statement = (
            select(Family)
            .where(Family.id == family_id)
            .options(
                selectinload(Family.family_tags).selectinload(FamilyTag.tag),
                selectinload(Family.family_members).selectinload(FamilyMember.contact),
            )
        )
        return self._session.execute(statement).scalar_one_or_none()
