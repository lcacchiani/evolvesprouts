"""Repository for Location entities."""

from __future__ import annotations


from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Location
from app.db.repositories.base import BaseRepository


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
        query = (
            select(Location)
            .where(Location.area_id == area_id)
            .order_by(Location.id)
            .limit(limit)
        )
        return self._session.execute(query).scalars().all()

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
