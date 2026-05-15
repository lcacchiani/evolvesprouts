"""Repository for CRM family entities."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Contact, Family, FamilyMember, Location
from app.db.models.tag import FamilyTag
from app.db.repositories.base import BaseRepository
from app.db.repositories.organization import _escape_like_pattern


class FamilyRepository(BaseRepository[Family]):
    """List and load families for admin CRM."""

    def __init__(self, session: Session):
        super().__init__(session, Family)

    @staticmethod
    def _admin_list_query_filter(query: str) -> Any:
        """Match family name or any linked member contact (name or email)."""
        escaped = _escape_like_pattern(query.strip())
        pattern = f"%{escaped}%"
        full_name = func.trim(
            func.concat(Contact.first_name, " ", func.coalesce(Contact.last_name, ""))
        )
        member_match = exists(
            select(1)
            .select_from(FamilyMember)
            .join(Contact, FamilyMember.contact_id == Contact.id)
            .where(
                FamilyMember.family_id == Family.id,
                or_(
                    Contact.first_name.ilike(pattern, escape="\\"),
                    Contact.last_name.ilike(pattern, escape="\\"),
                    Contact.email.ilike(pattern, escape="\\"),
                    full_name.ilike(pattern, escape="\\"),
                ),
            )
        )
        return or_(Family.family_name.ilike(pattern, escape="\\"), member_match)

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
            selectinload(Family.location).selectinload(Location.area),
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
            statement = statement.where(
                FamilyRepository._admin_list_query_filter(query)
            )
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
            statement = statement.where(
                FamilyRepository._admin_list_query_filter(query)
            )
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
                selectinload(Family.location).selectinload(Location.area),
            )
        )
        return self._session.execute(statement).scalar_one_or_none()
