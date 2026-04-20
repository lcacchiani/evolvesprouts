"""Shared location + HK district resolution for legacy importers."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeographicArea
from app.db.models import Location


def hk_country_id(session: Session) -> UUID:
    q = select(GeographicArea.id).where(
        GeographicArea.parent_id.is_(None),
        GeographicArea.code == "HK",
        GeographicArea.level == "country",
    )
    row = session.execute(q).scalar_one_or_none()
    if row is None:
        msg = "No geographic_areas row for Hong Kong (code=HK, root). Run migrations."
        raise RuntimeError(msg)
    return UUID(str(row))


def district_area_map(session: Session, hk_id: UUID) -> dict[str, UUID]:
    q = select(GeographicArea.id, GeographicArea.name).where(
        GeographicArea.parent_id == hk_id,
        GeographicArea.level == "district",
    )
    m: dict[str, UUID] = {}
    for aid, name in session.execute(q).all():
        m[str(name)] = UUID(str(aid))
    return m


def nonempty(value: str | None) -> bool:
    return bool(value and value.strip())


def usable_legacy_address(
    district_id: int | None,
    address_line1: str | None,
    address_line2: str | None,
) -> bool:
    return district_id is not None and (
        nonempty(address_line1) or nonempty(address_line2)
    )


def joined_address(line1: str | None, line2: str | None) -> str | None:
    parts = [p for p in (line1, line2) if nonempty(p)]
    if not parts:
        return None
    return ", ".join(parts)


def parse_lat_lng(
    latitude: str | None,
    longitude: str | None,
) -> tuple[Decimal | None, Decimal | None]:
    lat: Decimal | None = None
    lng: Decimal | None = None
    if latitude not in (None, ""):
        try:
            lat = Decimal(str(latitude).strip())
        except Exception:
            lat = None
    if longitude not in (None, ""):
        try:
            lng = Decimal(str(longitude).strip())
        except Exception:
            lng = None
    return lat, lng


def create_location_from_legacy_address(
    session: Session,
    *,
    area_id: UUID,
    name: str | None,
    address: str | None,
    latitude: str | None,
    longitude: str | None,
) -> Location:
    lat, lng = parse_lat_lng(latitude, longitude)
    loc = Location(
        area_id=area_id,
        name=name,
        address=address,
        lat=lat,
        lng=lng,
    )
    session.add(loc)
    session.flush()
    return loc
