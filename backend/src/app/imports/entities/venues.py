"""Venues entity: legacy ``venue`` rows → ``locations`` + ``legacy_import_refs``."""

from __future__ import annotations

from collections.abc import Mapping
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import replace
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeographicArea
from app.db.models import Location
from app.imports import mysqldump
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.registry import register
from app.imports import refs
from app.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class LegacyVenue:
    """One legacy ``venue`` row from a mysqldump ``INSERT``."""

    legacy_id: int
    name: str | None
    address: str | None
    district_id: int | None
    district_label: str | None = None


def _parse_legacy_districts(sql_text: str) -> dict[int, str]:
    stmt = mysqldump.extract_insert_statement(sql_text, "district")
    if stmt is None:
        msg = "Could not find INSERT INTO `district` in dump."
        raise ValueError(msg)
    m = mysqldump.INSERT_RE.match(stmt)
    if m is None:
        raise ValueError("Unexpected district INSERT shape.")
    rest = m.group("rest").rstrip()
    if rest.endswith(";"):
        rest = rest[:-1].rstrip()
    groups = mysqldump.iter_groups(rest)
    out: dict[int, str] = {}
    for g in groups:
        fields = mysqldump.split_fields(g)
        if len(fields) < 2:
            continue
        did = int(str(fields[0]))
        name = str(fields[1])
        out[did] = name
    return out


def _parse_legacy_venues(
    sql_text: str,
    *,
    districts: Mapping[int, str] | None = None,
) -> list[LegacyVenue]:
    district_map: Mapping[int, str] = (
        districts if districts is not None else _parse_legacy_districts(sql_text)
    )
    stmt = mysqldump.extract_insert_statement(sql_text, "venue")
    if stmt is None:
        msg = "Could not find INSERT INTO `venue` in dump."
        raise ValueError(msg)
    m = mysqldump.INSERT_RE.match(stmt)
    if m is None:
        raise ValueError("Unexpected venue INSERT shape.")
    rest = m.group("rest").rstrip()
    if rest.endswith(";"):
        rest = rest[:-1].rstrip()
    groups = mysqldump.iter_groups(rest)
    rows: list[LegacyVenue] = []
    for g in groups:
        fields = mysqldump.split_fields(g)
        if len(fields) < 5:
            continue
        legacy_id = int(str(fields[0]))
        name = str(fields[1]) if fields[1] is not None else ""
        line1 = fields[2]
        line2 = fields[3]
        district_raw = fields[4]
        district_id = int(str(district_raw)) if district_raw is not None else None
        dlabel = district_map.get(district_id) if district_id is not None else None
        parts = [p for p in (line1, line2) if p]
        address = ", ".join(parts) if parts else None
        rows.append(
            LegacyVenue(
                legacy_id=legacy_id,
                name=name.strip() or None,
                address=address,
                district_id=district_id,
                district_label=dlabel,
            )
        )
    return rows


def _hk_country_id(session: Session) -> UUID:
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


def _district_area_map(session: Session, hk_id: UUID) -> dict[str, UUID]:
    q = select(GeographicArea.id, GeographicArea.name).where(
        GeographicArea.parent_id == hk_id,
        GeographicArea.level == "district",
    )
    m: dict[str, UUID] = {}
    for aid, name in session.execute(q).all():
        m[str(name)] = UUID(str(aid))
    return m


def _dedupe_key(name: str | None, address: str | None) -> tuple[str, str]:
    n = (name or "").strip().lower()
    a = (address or "").strip().lower()
    return (n, a)


class VenueImporter:
    """Import legacy venues into ``locations`` and record ``legacy_import_refs``."""

    ENTITY: ClassVar[str] = "venues"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyVenue]:
        districts = _parse_legacy_districts(sql_text)
        return _parse_legacy_venues(sql_text, districts=districts)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        hk_id = _hk_country_id(session)
        area_by_name = _district_area_map(session, hk_id)
        area_ids = list(area_by_name.values())
        # TODO: narrow duplicate scan if `locations` grows very large.
        existing_keys: set[tuple[str, str]] = set()
        if area_ids:
            dup_query = select(Location.name, Location.address).where(
                Location.area_id.in_(area_ids)
            )
            for row in session.execute(dup_query).all():
                existing_keys.add(_dedupe_key(row[0], row[1]))
        return ImporterContext(
            area_by_name=area_by_name,
            existing_keys=existing_keys,
            refs_by_entity={},
        )

    def apply(
        self,
        session: Session,
        rows: Sequence[Any],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        stats = ImportStats(entity=self.ENTITY, dry_run=dry_run)
        area_by_name = ctx.area_by_name
        existing_keys = set(ctx.existing_keys)

        for v in rows:
            if not isinstance(v, LegacyVenue):
                continue
            dname = v.district_label
            if (
                dname is None
                and v.district_id is not None
                and ctx.district_map is not None
            ):
                dname = ctx.district_map.get(v.district_id)
            area_id = area_by_name.get(dname) if dname else None
            if area_id is None:
                logger.warning(
                    "Skipping legacy venue id=%s: no geographic_areas match for "
                    "district id=%r name=%r",
                    v.legacy_id,
                    v.district_id,
                    dname,
                )
                stats.skipped_no_area += 1
                continue

            name = v.name
            address = v.address
            key = _dedupe_key(name, address)
            if key in existing_keys:
                stats.skipped_duplicate += 1
                continue

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(v, None))
                stats.inserted += 1
                existing_keys.add(key)
                continue

            new_location = Location(
                area_id=area_id,
                name=name,
                address=address,
                lat=None,
                lng=None,
            )
            session.add(new_location)
            # Flush so Location.id is available for legacy_import_refs (same transaction).
            session.flush()
            nid = new_location.id
            new_uuid = nid if isinstance(nid, UUID) else UUID(str(nid))
            refs.record_mapping(
                session,
                self.ENTITY,
                str(v.legacy_id),
                new_uuid,
            )
            stats.inserted += 1
            existing_keys.add(key)

        if not dry_run:
            session.commit()

        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyVenue):
            return ""
        dname = row.district_label or ""
        return (
            "Would insert: "
            f"name={preview_line(self, row.name or '')!r} | "
            f"address={preview_line(self, row.address or '')!r} | "
            f"area={preview_line(self, dname)!r}"
        )


# Public aliases for tests and tooling (same signatures as pre-registry module).
def parse_legacy_districts(sql_text: str) -> dict[int, str]:
    return _parse_legacy_districts(sql_text)


def parse_legacy_venues(
    sql_text: str,
    *,
    districts: Mapping[int, str] | None = None,
) -> list[LegacyVenue]:
    return _parse_legacy_venues(sql_text, districts=districts)


def apply_venues(
    session: Session,
    venues: Sequence[LegacyVenue],
    *,
    dry_run: bool,
    district_map: Mapping[int, str] | None = None,
) -> ImportStats:
    """Apply venue rows (used by tests; delegates to :class:`VenueImporter`)."""
    importer = VenueImporter()
    ctx = importer.resolve_context(session, dry_run=dry_run)
    dm = dict(district_map) if district_map is not None else None
    ctx = replace(ctx, district_map=dm)
    return importer.apply(session, venues, ctx, dry_run=dry_run)


register(VenueImporter())
