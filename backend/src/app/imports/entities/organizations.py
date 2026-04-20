"""Organizations entity: legacy ``family`` rows (kind=company) → ``organizations``."""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import replace
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import Organization
from app.db.models.enums import OrganizationType
from app.db.models.enums import RelationshipType
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_family_common import LegacyFamilyRow
from app.imports.entities._legacy_family_common import legacy_family_id_to_person_kinds
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


def _tokenize_for_match(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return f" {s} "


# (OrganizationType value, list of token-boundary phrases; order matters — first match wins.)
ORGANIZATION_TYPE_RULES: tuple[tuple[OrganizationType, tuple[str, ...]], ...] = (
    (
        OrganizationType.SCHOOL,
        (
            "school",
            "kindergarten",
            "academy",
            "college",
            "university",
            "preschool",
            "nursery",
            "edu",
        ),
    ),
    (
        OrganizationType.NGO,
        (
            "ngo",
            "foundation",
            "charity",
            "non-profit",
            "non profit",
            "society",
            "association",
            "council",
        ),
    ),
    (
        OrganizationType.COMMUNITY_GROUP,
        (
            "group",
            "club",
            "community",
            "meetup",
            "network",
            "circle",
        ),
    ),
    (
        OrganizationType.COMPANY,
        (
            "limited",
            "ltd",
            "inc",
            "co.",
            "llc",
            "plc",
            "consult",
            "agency",
            "studio",
            "solutions",
            "services",
        ),
    ),
)


def infer_organization_type_from_name(name: str | None) -> OrganizationType:
    if not name or not name.strip():
        return OrganizationType.OTHER
    hay = _tokenize_for_match(name)
    for org_type, phrases in ORGANIZATION_TYPE_RULES:
        for p in phrases:
            needle = f" {p} "
            if needle in hay:
                return org_type
    return OrganizationType.OTHER


class OrganizationsImporter:
    """Import legacy companies (``kind='company'``) into ``organizations``."""

    ENTITY: ClassVar[str] = "organizations"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyFamilyRow]:
        rows = parse_legacy_family_rows(sql_text)
        return [r for r in rows if (r.kind or "").strip().lower() == "company"]

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del dry_run
        hk_id = hk_country_id(session)
        area_by_name = district_area_map(session, hk_id)
        return ImporterContext(area_by_name=area_by_name)

    def _row_detail(
        self,
        row: LegacyFamilyRow,
        *,
        org_id: UUID | None,
        location_id: UUID | None,
        org_type: OrganizationType,
        rel: RelationshipType,
        dry_run: bool,
    ) -> dict[str, Any]:
        org_values: dict[str, Any] = {
            "name": row.name,
            "organization_type": org_type.value,
            "relationship_type": rel.value,
            "website": None,
            "location_id": str(location_id) if location_id else None,
        }
        tables: list[dict[str, Any]] = [
            {
                "table": "organizations",
                "columns": [
                    "name",
                    "organization_type",
                    "relationship_type",
                    "website",
                    "location_id",
                ],
                "values": org_values,
            },
            {
                "table": "legacy_import_refs",
                "columns": ["entity", "legacy_key", "new_id"],
                "values": {
                    "entity": self.ENTITY,
                    "legacy_key": str(row.legacy_id),
                    "new_id": None if dry_run or org_id is None else str(org_id),
                },
            },
        ]
        return {
            "legacy_source": {"table": "family", "primary_key": {"id": row.legacy_id}},
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
        partner_map: dict[int, set[str]] = {}
        if ctx.source_sql_text is not None:
            partner_map = legacy_family_id_to_person_kinds(ctx.source_sql_text)

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

            org_type = infer_organization_type_from_name(row.name)
            kinds = partner_map.get(row.legacy_id, set())
            rel = (
                RelationshipType.PARTNER
                if "partner" in kinds
                else RelationshipType.PROSPECT
            )

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
                        "Skipping location for legacy org family id=%s: no area for district=%r",
                        row.legacy_id,
                        dname,
                    )
                elif not dry_run:
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
                            org_id=None,
                            location_id=location_id,
                            org_type=org_type,
                            rel=rel,
                            dry_run=True,
                        ),
                    )
                stats.inserted += 1
                continue

            org = Organization(
                name=row.name or "",
                organization_type=org_type,
                relationship_type=rel,
                website=None,
                location_id=location_id,
            )
            session.add(org)
            session.flush()
            oid = org.id
            org_uuid = oid if isinstance(oid, UUID) else UUID(str(oid))
            refs.record_mapping(session, self.ENTITY, str(row.legacy_id), org_uuid)
            if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                stats.row_details.append(
                    self._row_detail(
                        row,
                        org_id=org_uuid,
                        location_id=location_id,
                        org_type=org_type,
                        rel=rel,
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
        ot = infer_organization_type_from_name(row.name)
        return (
            "Would insert: "
            f"name={preview_line(self, row.name or '')!r} | "
            f"organization_type={ot.value} | legacy_id={row.legacy_id}"
        )


def apply_organizations(
    session: Session,
    org_rows: Sequence[LegacyFamilyRow],
    *,
    dry_run: bool,
    sql_text: str,
    skip_legacy_keys: frozenset[str] | None = None,
) -> ImportStats:
    importer = OrganizationsImporter()
    base = importer.resolve_context(session, dry_run=dry_run)
    sk = skip_legacy_keys or frozenset()
    from app.imports import refs as refs_mod

    existing = refs_mod.load_legacy_keys(session, importer.ENTITY)
    ctx = replace(
        base,
        skip_legacy_keys=base.skip_legacy_keys | sk,
        source_sql_text=sql_text,
        existing_import_keys=base.existing_import_keys | existing,
    )
    return importer.apply(session, org_rows, ctx, dry_run=dry_run)


register(OrganizationsImporter())
