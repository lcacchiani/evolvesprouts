"""Asset and asset access grant models."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base
from app.db.models.enums import AccessGrantType, AssetType, AssetVisibility


def _enum_values(
    enum_cls: Iterable[AssetType | AssetVisibility | AccessGrantType],
) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class Asset(Base):
    """Client-facing downloadable asset metadata."""

    __tablename__ = "assets"
    __table_args__ = (
        Index("assets_visibility_idx", "visibility"),
        Index("assets_asset_type_idx", "asset_type"),
        Index("assets_created_by_idx", "created_by"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    asset_type: Mapped[AssetType] = mapped_column(
        Enum(
            AssetType,
            name="asset_type",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    s3_key: Mapped[str] = mapped_column(String(), nullable=False, unique=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(127), nullable=True)
    visibility: Mapped[AssetVisibility] = mapped_column(
        Enum(
            AssetVisibility,
            name="asset_visibility",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    access_grants: Mapped[list["AssetAccessGrant"]] = relationship(
        back_populates="asset",
        cascade="all, delete-orphan",
    )


class AssetAccessGrant(Base):
    """Access grant for restricted assets."""

    __tablename__ = "asset_access_grants"
    __table_args__ = (
        Index("access_grants_asset_idx", "asset_id"),
        Index("access_grants_grantee_idx", "grantee_id"),
        Index(
            "access_grants_unique",
            "asset_id",
            "grant_type",
            text("COALESCE(grantee_id, '')"),
            unique=True,
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    grant_type: Mapped[AccessGrantType] = mapped_column(
        Enum(
            AccessGrantType,
            name="access_grant_type",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    grantee_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    granted_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    asset: Mapped["Asset"] = relationship(
        "Asset",
        back_populates="access_grants",
        primaryjoin="AssetAccessGrant.asset_id == Asset.id",
        foreign_keys=[asset_id],
    )
