"""Repository for asset and access grant entities."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import (
    AccessGrantType,
    Asset,
    AssetAccessGrant,
    AssetType,
    AssetVisibility,
)
from app.db.repositories.base import BaseRepository


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters."""
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class AssetRepository(BaseRepository[Asset]):
    """Repository for Asset CRUD and access grant operations."""

    def __init__(self, session: Session):
        super().__init__(session, Asset)

    def list_assets(
        self,
        *,
        limit: int = 50,
        cursor: Optional[UUID] = None,
        query: Optional[str] = None,
        visibility: Optional[AssetVisibility] = None,
        asset_type: Optional[AssetType] = None,
    ) -> Sequence[Asset]:
        """List assets with optional filtering and cursor pagination."""
        statement = select(Asset)
        if cursor is not None:
            statement = statement.where(Asset.id > cursor)
        if visibility is not None:
            statement = statement.where(Asset.visibility == visibility)
        if asset_type is not None:
            statement = statement.where(Asset.asset_type == asset_type)
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    Asset.title.ilike(pattern, escape="\\"),
                    Asset.file_name.ilike(pattern, escape="\\"),
                )
            )
        statement = statement.order_by(Asset.id).limit(limit)
        return self._session.execute(statement).scalars().all()

    def list_public_assets(
        self,
        *,
        limit: int = 50,
        cursor: Optional[UUID] = None,
    ) -> Sequence[Asset]:
        """List public assets only."""
        statement = select(Asset).where(Asset.visibility == AssetVisibility.PUBLIC)
        if cursor is not None:
            statement = statement.where(Asset.id > cursor)
        statement = statement.order_by(Asset.id).limit(limit)
        return self._session.execute(statement).scalars().all()

    def list_accessible_assets(
        self,
        *,
        user_sub: str,
        organization_ids: set[str],
        is_admin_or_manager: bool,
        limit: int = 50,
        cursor: Optional[UUID] = None,
    ) -> Sequence[Asset]:
        """List assets visible to a specific authenticated user."""
        if is_admin_or_manager:
            return self.list_assets(limit=limit, cursor=cursor)

        grant_filter = _build_grant_filter(
            user_sub=user_sub, organization_ids=organization_ids
        )
        grant_exists = (
            select(AssetAccessGrant.id)
            .where(and_(AssetAccessGrant.asset_id == Asset.id, grant_filter))
            .exists()
        )
        statement = select(Asset).where(
            or_(
                Asset.visibility == AssetVisibility.PUBLIC,
                and_(Asset.visibility == AssetVisibility.RESTRICTED, grant_exists),
            )
        )
        if cursor is not None:
            statement = statement.where(Asset.id > cursor)
        statement = statement.order_by(Asset.id).limit(limit)
        return self._session.execute(statement).scalars().all()

    def can_access_asset(
        self,
        *,
        asset: Asset,
        user_sub: Optional[str],
        organization_ids: set[str],
        is_admin_or_manager: bool,
        is_authenticated: bool,
    ) -> bool:
        """Return whether a principal can access the given asset."""
        if asset.visibility == AssetVisibility.PUBLIC:
            return True
        if not is_authenticated:
            return False
        if is_admin_or_manager:
            return True
        if not user_sub:
            return False

        grant_filter = _build_grant_filter(
            user_sub=user_sub, organization_ids=organization_ids
        )
        statement = (
            select(func.count())
            .select_from(AssetAccessGrant)
            .where(and_(AssetAccessGrant.asset_id == asset.id, grant_filter))
        )
        count = self._session.execute(statement).scalar_one()
        return count > 0

    def create_asset(
        self,
        *,
        asset_id: UUID,
        title: str,
        description: Optional[str],
        asset_type: AssetType,
        s3_key: str,
        file_name: str,
        content_type: Optional[str],
        visibility: AssetVisibility,
        created_by: str,
    ) -> Asset:
        """Create and persist an asset."""
        entity = Asset(
            id=asset_id,
            title=title,
            description=description,
            asset_type=asset_type,
            s3_key=s3_key,
            file_name=file_name,
            content_type=content_type,
            visibility=visibility,
            created_by=created_by,
        )
        return self.create(entity)

    def update_asset(
        self,
        asset: Asset,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        asset_type: Optional[AssetType] = None,
        file_name: Optional[str] = None,
        content_type: Optional[str] = None,
        visibility: Optional[AssetVisibility] = None,
        s3_key: Optional[str] = None,
    ) -> Asset:
        """Update mutable asset fields."""
        if title is not None:
            asset.title = title
        if description is not None:
            asset.description = description
        if asset_type is not None:
            asset.asset_type = asset_type
        if file_name is not None:
            asset.file_name = file_name
        if content_type is not None:
            asset.content_type = content_type
        if visibility is not None:
            asset.visibility = visibility
        if s3_key is not None:
            asset.s3_key = s3_key
        return self.update(asset)

    def list_grants(self, *, asset_id: UUID) -> Sequence[AssetAccessGrant]:
        """List all grants for an asset."""
        statement = (
            select(AssetAccessGrant)
            .where(AssetAccessGrant.asset_id == asset_id)
            .order_by(AssetAccessGrant.created_at.desc(), AssetAccessGrant.id.desc())
        )
        return self._session.execute(statement).scalars().all()

    def get_grant(
        self,
        *,
        asset_id: UUID,
        grant_id: UUID,
    ) -> Optional[AssetAccessGrant]:
        """Get a grant by ID scoped to an asset."""
        statement = select(AssetAccessGrant).where(
            and_(AssetAccessGrant.asset_id == asset_id, AssetAccessGrant.id == grant_id)
        )
        return self._session.execute(statement).scalar_one_or_none()

    def create_grant(
        self,
        *,
        asset_id: UUID,
        grant_type: AccessGrantType,
        grantee_id: Optional[str],
        granted_by: str,
    ) -> AssetAccessGrant:
        """Create and persist an access grant."""
        entity = AssetAccessGrant(
            asset_id=asset_id,
            grant_type=grant_type,
            grantee_id=grantee_id,
            granted_by=granted_by,
        )
        self._session.add(entity)
        self._session.flush()
        self._session.refresh(entity)
        return entity

    def delete_grant(self, grant: AssetAccessGrant) -> None:
        """Delete an existing access grant."""
        self._session.delete(grant)
        self._session.flush()

    def find_matching_grant(
        self,
        *,
        asset_id: UUID,
        grant_type: AccessGrantType,
        grantee_id: Optional[str],
    ) -> Optional[AssetAccessGrant]:
        """Find an existing grant by unique key."""
        normalized_grantee = grantee_id or ""
        statement = select(AssetAccessGrant).where(
            and_(
                AssetAccessGrant.asset_id == asset_id,
                AssetAccessGrant.grant_type == grant_type,
                func.coalesce(AssetAccessGrant.grantee_id, "") == normalized_grantee,
            )
        )
        return self._session.execute(statement).scalar_one_or_none()


def _build_grant_filter(
    *,
    user_sub: str,
    organization_ids: set[str],
) -> ColumnElement[bool]:
    """Build SQL filter for grants matching the principal."""
    grant_clauses: list[ColumnElement[bool]] = [
        AssetAccessGrant.grant_type == AccessGrantType.ALL_AUTHENTICATED,
        and_(
            AssetAccessGrant.grant_type == AccessGrantType.USER,
            AssetAccessGrant.grantee_id == user_sub,
        ),
    ]
    if organization_ids:
        grant_clauses.append(
            and_(
                AssetAccessGrant.grant_type == AccessGrantType.ORGANIZATION,
                AssetAccessGrant.grantee_id.in_(sorted(organization_ids)),
            )
        )
    return or_(*grant_clauses)
