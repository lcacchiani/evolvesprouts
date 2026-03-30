"""Repository for Location entities."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Location
from app.db.repositories.base import BaseRepository


def _escape_ilike_pattern(term: str) -> str:
    """Escape ILIKE wildcards so user input is matched literally."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class LocationRepository(BaseRepository[Location]):
    """Repository for Location CRUD operations."""

    def __init__(self, session: Session):
        """Initialize the repository."""
        super().__init__(session, Location)

    def find_by_area(
        self,
        area_id: UUID,
        limit: int = 50,
    ) -> Sequence[Location]:
        """Find locations by geographic area."""
        return self.list_with_filters(area_id=area_id, limit=limit, cursor=None)

    def list_with_filters(
        self,
        *,
        limit: int,
        cursor: UUID | None = None,
        area_id: UUID | None = None,
        search: str | None = None,
    ) -> Sequence[Location]:
        """List locations with optional area and address search (case-insensitive)."""
        query = select(Location).order_by(Location.id)
        if cursor is not None:
            query = query.where(Location.id > cursor)
        if area_id is not None:
            query = query.where(Location.area_id == area_id)
        if search and search.strip():
            pattern = f"%{_escape_ilike_pattern(search.strip())}%"
            query = query.where(Location.address.isnot(None)).where(
                Location.address.ilike(pattern, escape="\\")
            )
        return self._session.execute(query.limit(limit)).scalars().all()

    def count_with_filters(
        self,
        *,
        area_id: UUID | None = None,
        search: str | None = None,
    ) -> int:
        """Count locations matching optional area and address search."""
        query = select(func.count()).select_from(Location)
        if area_id is not None:
            query = query.where(Location.area_id == area_id)
        if search and search.strip():
            pattern = f"%{_escape_ilike_pattern(search.strip())}%"
            query = query.where(Location.address.isnot(None)).where(
                Location.address.ilike(pattern, escape="\\")
            )
        return int(self._session.execute(query).scalar_one())

    def find_by_address_case_insensitive(
        self,
        address: str,
    ) -> Location | None:
        """Find a location by case-insensitive address."""
        normalized = address.strip()
        query = select(Location).where(
            func.lower(func.trim(Location.address)) == func.lower(func.trim(normalized))
        )
        return self._session.execute(query).scalar_one_or_none()
