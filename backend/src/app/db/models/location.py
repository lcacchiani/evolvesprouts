"""Location model."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.family import Family
    from app.db.models.geographic_area import GeographicArea
    from app.db.models.organization import Organization


class Location(Base):
    """Location for an organization."""

    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    area_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("geographic_areas.id"),
        nullable=False,
        comment="FK to geographic_areas leaf node",
    )
    address: Mapped[str | None] = mapped_column(Text(), nullable=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
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

    area: Mapped[GeographicArea] = relationship()
    contacts: Mapped[list[Contact]] = relationship(
        "Contact",
        back_populates="location",
    )
    families: Mapped[list[Family]] = relationship(
        "Family",
        back_populates="location",
    )
    organizations: Mapped[list[Organization]] = relationship(
        "Organization",
        back_populates="location",
    )
