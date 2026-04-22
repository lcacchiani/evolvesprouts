"""Repository for Location entities."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import exists

from app.db.models import Family, Location, Organization, RelationshipType
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
        exclude_crm_addresses: bool = False,
    ) -> Sequence[Location]:
        """List locations with optional area and address search (case-insensitive)."""
        query = select(Location).order_by(Location.id)
        if cursor is not None:
            query = query.where(Location.id > cursor)
        if area_id is not None:
            query = query.where(Location.area_id == area_id)
        if search and search.strip():
            pattern = f"%{_escape_ilike_pattern(search.strip())}%"
            name_match = Location.name.isnot(None) & Location.name.ilike(
                pattern, escape="\\"
            )
            address_match = Location.address.isnot(None) & Location.address.ilike(
                pattern, escape="\\"
            )
            query = query.where(or_(name_match, address_match))
        if exclude_crm_addresses:
            query = query.where(self._not_linked_to_active_family_or_org())
        return self._session.execute(query.limit(limit)).scalars().all()

    def count_with_filters(
        self,
        *,
        area_id: UUID | None = None,
        search: str | None = None,
        exclude_crm_addresses: bool = False,
    ) -> int:
        """Count locations matching optional area and address search."""
        query = select(func.count()).select_from(Location)
        if area_id is not None:
            query = query.where(Location.area_id == area_id)
        if search and search.strip():
            pattern = f"%{_escape_ilike_pattern(search.strip())}%"
            name_match = Location.name.isnot(None) & Location.name.ilike(
                pattern, escape="\\"
            )
            address_match = Location.address.isnot(None) & Location.address.ilike(
                pattern, escape="\\"
            )
            query = query.where(or_(name_match, address_match))
        if exclude_crm_addresses:
            query = query.where(self._not_linked_to_active_family_or_org())
        return int(self._session.execute(query).scalar_one())

    @staticmethod
    def _not_linked_to_active_family_or_org() -> Any:
        """Exclude rows referenced as venue by a non-archived family or organisation."""
        family_link = exists().where(
            Family.location_id == Location.id,
            Family.archived_at.is_(None),
        )
        org_link = exists().where(
            Organization.location_id == Location.id,
            Organization.archived_at.is_(None),
        )
        return and_(not_(family_link), not_(org_link))

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

    def active_partner_organization_names_by_location_ids(
        self,
        location_ids: Sequence[UUID],
    ) -> dict[UUID, list[str]]:
        """Map location ids to sorted names of active partner CRM organizations."""
        if not location_ids:
            return {}
        stmt = (
            select(Organization.location_id, Organization.name)
            .where(
                Organization.location_id.in_(location_ids),
                Organization.relationship_type == RelationshipType.PARTNER,
                Organization.archived_at.is_(None),
            )
            .order_by(Organization.name.asc())
        )
        rows = self._session.execute(stmt).all()
        by_loc: dict[UUID, list[str]] = defaultdict(list)
        for loc_id, name in rows:
            if loc_id is None:
                continue
            label = (name or "").strip() or "Partner organisation"
            by_loc[loc_id].append(label)
        return dict(by_loc)
