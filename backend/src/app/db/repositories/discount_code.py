"""Repository for discount code operations."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.db.models import DiscountCode
from app.db.repositories.base import BaseRepository


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters."""
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class DiscountCodeRepository(BaseRepository[DiscountCode]):
    """Repository for discount code queries and updates."""

    def __init__(self, session: Session):
        super().__init__(session, DiscountCode)

    def list_codes(
        self,
        *,
        limit: int,
        active: bool | None = None,
        service_id: UUID | None = None,
        instance_id: UUID | None = None,
        scope: str | None = None,
        search: str | None = None,
        cursor_created_at: datetime | None = None,
        cursor_id: UUID | None = None,
    ) -> list[DiscountCode]:
        """List discount codes with filtering and cursor pagination."""
        statement = select(DiscountCode)
        if active is not None:
            statement = statement.where(DiscountCode.active == active)
        if service_id is not None:
            statement = statement.where(DiscountCode.service_id == service_id)
        if instance_id is not None:
            statement = statement.where(DiscountCode.instance_id == instance_id)
        if scope == "unscoped":
            statement = statement.where(DiscountCode.service_id.is_(None)).where(
                DiscountCode.instance_id.is_(None)
            )
        elif scope == "service":
            statement = statement.where(DiscountCode.service_id.is_not(None)).where(
                DiscountCode.instance_id.is_(None)
            )
        elif scope == "instance":
            statement = statement.where(DiscountCode.instance_id.is_not(None))
        if search:
            escaped = _escape_like_pattern(search.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    DiscountCode.code.ilike(pattern, escape="\\"),
                    DiscountCode.description.ilike(pattern, escape="\\"),
                )
            )
        if cursor_created_at is not None and cursor_id is not None:
            statement = statement.where(
                or_(
                    DiscountCode.created_at < cursor_created_at,
                    and_(
                        DiscountCode.created_at == cursor_created_at,
                        DiscountCode.id < cursor_id,
                    ),
                )
            )
        statement = statement.order_by(
            DiscountCode.created_at.desc(),
            DiscountCode.id.desc(),
        ).limit(limit)
        return list(self._session.execute(statement).scalars().all())

    def count_codes(
        self,
        *,
        active: bool | None = None,
        service_id: UUID | None = None,
        instance_id: UUID | None = None,
        scope: str | None = None,
        search: str | None = None,
    ) -> int:
        """Count discount codes with the same filters used by list."""
        statement = select(func.count(DiscountCode.id))
        if active is not None:
            statement = statement.where(DiscountCode.active == active)
        if service_id is not None:
            statement = statement.where(DiscountCode.service_id == service_id)
        if instance_id is not None:
            statement = statement.where(DiscountCode.instance_id == instance_id)
        if scope == "unscoped":
            statement = statement.where(DiscountCode.service_id.is_(None)).where(
                DiscountCode.instance_id.is_(None)
            )
        elif scope == "service":
            statement = statement.where(DiscountCode.service_id.is_not(None)).where(
                DiscountCode.instance_id.is_(None)
            )
        elif scope == "instance":
            statement = statement.where(DiscountCode.instance_id.is_not(None))
        if search:
            escaped = _escape_like_pattern(search.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    DiscountCode.code.ilike(pattern, escape="\\"),
                    DiscountCode.description.ilike(pattern, escape="\\"),
                )
            )
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def discount_code_usage_summary_for_service(
        self, service_id: UUID
    ) -> tuple[int, int]:
        """Return (sum of current_uses, count of codes) for codes scoped to service."""
        statement = select(
            func.coalesce(func.sum(DiscountCode.current_uses), 0),
            func.count(DiscountCode.id),
        ).where(DiscountCode.service_id == service_id)
        row = self._session.execute(statement).one()
        return int(row[0] or 0), int(row[1] or 0)

    def get_by_code(self, code: str) -> DiscountCode | None:
        """Return one code by case-insensitive key."""
        normalized = code.strip().lower()
        if not normalized:
            return None
        statement = select(DiscountCode).where(
            func.lower(DiscountCode.code) == normalized
        )
        return self._session.execute(statement).scalar_one_or_none()

    def validate_and_increment(self, code_id: UUID) -> bool:
        """Atomically validate and consume one code usage."""
        now = datetime.now(UTC)
        statement = (
            update(DiscountCode)
            .where(DiscountCode.id == code_id)
            .where(DiscountCode.active.is_(True))
            .where(
                or_(DiscountCode.valid_from.is_(None), DiscountCode.valid_from <= now)
            )
            .where(
                or_(DiscountCode.valid_until.is_(None), DiscountCode.valid_until >= now)
            )
            .where(
                or_(
                    DiscountCode.max_uses.is_(None),
                    DiscountCode.current_uses < DiscountCode.max_uses,
                )
            )
            .values(current_uses=DiscountCode.current_uses + 1)
            .returning(DiscountCode.id)
        )
        row = self._session.execute(statement).first()
        return row is not None
