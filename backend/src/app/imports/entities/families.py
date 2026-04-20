"""Families entity: legacy ``family`` rows (kind=family) → ``families`` + optional ``locations``."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import Family
from app.db.models.enums import RelationshipType
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_family_common import LegacyFamilyRow
from app.imports.entities._legacy_family_common import parse_legacy_family_rows
from app.imports.entities._locations_common import create_location_from_legacy_address
from app.imports.entities._locations_common import district_area_map
from app.imports.entities._locations_common import hk_country_id
from app.imports.entities._locations_common import joined_address
from app.imports.entities._locations_common import usable_legacy_address
from app.imports.registry import register
from app.imports import refs
from app.utils.logging import get_logger

logger = get_logger(__name__)


class FamiliesImporter:
    """Import legacy families (``kind='family'``) into ``families``."""

    ENTITY: ClassVar[str] = "families"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = True
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyFamilyRow]:
        rows = parse_legacy_family_rows(sql_text)
        return [r for r in rows if (r.kind or "").strip().lower() == "family"]

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        hk_id = hk_country_id(session)
        area_by_name = district_area_map(session, hk_id)
        return ImporterContext(area_by_name=area_by_name)

    def _row_detail(
        self,
        row: LegacyFamilyRow,
        *,
        family_id: UUID | None,
        location_id: UUID | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        fam_values: dict[str, Any] = {
            "family_name": preview_line(self, row.name or ""),
            "relationship_type": RelationshipType.PROSPECT.value,
            "location_id": str(location_id) if location_id else None,
        }
        tables: list[dict[str, Any]] = [
            {
                "table": "families",
                "columns": ["family_name", "relationship_type", "location_id"],
                "values": fam_values,
            },
        ]
        ref_values: dict[str, Any] = {
            "entity": self.ENTITY,
            "legacy_key": str(row.legacy_id),
            "new_id": None if dry_run or family_id is None else str(family_id),
        }
        tables.append(
            {
                "table": "legacy_import_refs",
                "columns": ["entity", "legacy_key", "new_id"],
                "values": ref_values,
            },
        )
        return {
            "legacy_source": {
                "table": "family",
                "primary_key": {"id": row.legacy_id},
            },
            "target": {"tables": tables},
            "dry_run": dry_run,
        }

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

        for row in rows:
            if not isinstance(row, LegacyFamilyRow):
                continue
            if str(row.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if row.deleted_at is not None:
                stats.skipped_deleted += 1
                continue
            if str(row.legacy_id) in ctx.existing_import_keys:
                stats.skipped_duplicate += 1
                continue

            dname = row.district_label
            addr = joined_address(row.address_line1, row.address_line2)
            location_id: UUID | None = None
            if usable_legacy_address(
                row.district_id,
                row.address_line1,
                row.address_line2,
            ):
                area_id = area_by_name.get(dname) if dname else None
                if area_id is None:
                    logger.warning(
                        "Skipping location for legacy family id=%s: no area for district=%r",
                        row.legacy_id,
                        dname,
                    )
                else:
                    if not dry_run:
                        loc = create_location_from_legacy_address(
                            session,
                            area_id=area_id,
                            name=row.name,
                            address=addr,
                            latitude=row.latitude,
                            longitude=row.longitude,
                        )
                        nid = loc.id
                        location_id = nid if isinstance(nid, UUID) else UUID(str(nid))

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(row, None))
                if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                    stats.row_details.append(
                        self._row_detail(
                            row,
                            family_id=None,
                            location_id=location_id,
                            dry_run=True,
                        ),
                    )
                stats.inserted += 1
                continue

            fam = Family(
                family_name=row.name or "",
                relationship_type=RelationshipType.PROSPECT,
                location_id=location_id,
            )
            session.add(fam)
            session.flush()
            fid = fam.id
            fam_uuid = fid if isinstance(fid, UUID) else UUID(str(fid))
            refs.record_mapping(session, self.ENTITY, str(row.legacy_id), fam_uuid)
            if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                stats.row_details.append(
                    self._row_detail(
                        row,
                        family_id=fam_uuid,
                        location_id=location_id,
                        dry_run=False,
                    ),
                )
            stats.inserted += 1

        if not dry_run:
            session.commit()

        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyFamilyRow):
            return ""
        return (
            "Would insert: "
            f"family_name={preview_line(self, row.name or '')!r} | "
            f"legacy_id={row.legacy_id}"
        )


def apply_families(
    session: Session,
    family_rows: Sequence[LegacyFamilyRow],
    *,
    dry_run: bool,
    skip_legacy_keys: frozenset[str] | None = None,
) -> ImportStats:
    importer = FamiliesImporter()
    ctx = importer.resolve_context(session, dry_run=dry_run)
    sk = skip_legacy_keys or frozenset()
    from app.imports import refs as refs_mod

    existing = refs_mod.load_legacy_keys(session, importer.ENTITY)
    ctx = replace(
        ctx,
        skip_legacy_keys=ctx.skip_legacy_keys | sk,
        existing_import_keys=ctx.existing_import_keys | existing,
    )
    return importer.apply(session, family_rows, ctx, dry_run=dry_run)


register(FamiliesImporter())
