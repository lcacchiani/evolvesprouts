"""One-off link importer: backfill ``family_members`` / ``organization_members``.

Uses existing ``legacy_import_refs`` mappings (``contacts``, ``families``,
``organizations``) to insert missing membership rows that link
already-imported contacts to their respective family or organization. Never
creates new contacts/families/organizations. Idempotent — re-runs leave
existing memberships untouched.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import exists
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Contact
from app.db.models import Family
from app.db.models import FamilyMember
from app.db.models import Organization
from app.db.models import OrganizationMember
from app.imports import refs
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_family_common import LegacyPersonRow
from app.imports.entities._legacy_family_common import parse_legacy_person_rows
from app.imports.entities.contacts import _family_role
from app.imports.entities.contacts import _org_role
from app.imports.entities.contacts import _title_trim
from app.imports.registry import register
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _prune_refs_to_existing(
    session: Session,
    ref_map: dict[str, UUID] | None,
    *,
    model: Any,
) -> tuple[dict[str, UUID], int]:
    """Return ``(pruned_map, dropped_count)`` filtering IDs missing from ``model``.

    ``legacy_import_refs`` is a soft pointer (no FK) — rows can survive after the
    referenced target row is deleted, which would cause FK violations on
    downstream inserts. Filter out stale mappings before planning links.
    """
    if not ref_map:
        return {}, 0
    candidate_ids = {v for v in ref_map.values() if v is not None}
    if not candidate_ids:
        return dict(ref_map), 0
    existing_ids: set[UUID] = set()
    rows = session.execute(select(model.id).where(model.id.in_(candidate_ids))).all()
    for (rid,) in rows:
        existing_ids.add(rid if isinstance(rid, UUID) else UUID(str(rid)))
    pruned = {k: v for k, v in ref_map.items() if v in existing_ids}
    return pruned, len(ref_map) - len(pruned)


def _family_membership_exists(
    session: Session,
    *,
    family_id: UUID,
    contact_id: UUID,
) -> bool:
    q = select(
        exists().where(
            FamilyMember.family_id == family_id,
            FamilyMember.contact_id == contact_id,
        ),
    )
    return bool(session.execute(q).scalar())


def _organization_membership_exists(
    session: Session,
    *,
    organization_id: UUID,
    contact_id: UUID,
) -> bool:
    q = select(
        exists().where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.contact_id == contact_id,
        ),
    )
    return bool(session.execute(q).scalar())


class LinkContactMembershipsImporter:
    """Backfill membership rows for already-imported contacts (one-off)."""

    ENTITY: ClassVar[str] = "link_contact_memberships"
    #: ``contacts`` must be present in ``legacy_import_refs`` (required precondition);
    #: ``families`` / ``organizations`` are optional dependency entities (empty tenant OK).
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("contacts", "families", "organizations")
    PII: ClassVar[bool] = True
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyPersonRow]:
        return parse_legacy_person_rows(sql_text)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del session, dry_run
        return ImporterContext()

    def _row_detail(
        self,
        p: LegacyPersonRow,
        *,
        action: str,
        parent_kind: str | None,
        parent_uuid: UUID | None,
        contact_uuid: UUID | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        tables: list[dict[str, Any]] = []
        if action in {"insert_family", "skip_family_exists"} and parent_uuid:
            tables.append(
                {
                    "table": "family_members",
                    "columns": ["family_id", "contact_id", "role"],
                    "values": {
                        "family_id": str(parent_uuid),
                        "contact_id": str(contact_uuid) if contact_uuid else None,
                        "role": _family_role(p.kind).value,
                    },
                },
            )
        elif action in {"insert_org", "skip_org_exists"} and parent_uuid:
            tables.append(
                {
                    "table": "organization_members",
                    "columns": [
                        "organization_id",
                        "contact_id",
                        "role",
                        "title",
                    ],
                    "values": {
                        "organization_id": str(parent_uuid),
                        "contact_id": str(contact_uuid) if contact_uuid else None,
                        "role": _org_role(p.kind).value,
                        "title": _title_trim(p.occupation),
                    },
                },
            )
        return {
            "legacy_source": {"table": "person", "primary_key": {"id": p.legacy_id}},
            "target": {"tables": tables},
            "action": action,
            "parent_kind": parent_kind,
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
        raw_contact_refs = ctx.refs_by_entity.get("contacts") or refs.load_mapping(
            session,
            "contacts",
        )
        raw_family_refs = ctx.refs_by_entity.get("families") or refs.load_mapping(
            session,
            "families",
        )
        raw_org_refs = ctx.refs_by_entity.get("organizations") or refs.load_mapping(
            session,
            "organizations",
        )

        contact_refs, stale_contact_refs = _prune_refs_to_existing(
            session,
            dict(raw_contact_refs),
            model=Contact,
        )
        family_refs, stale_family_refs = _prune_refs_to_existing(
            session,
            dict(raw_family_refs),
            model=Family,
        )
        org_refs, stale_org_refs = _prune_refs_to_existing(
            session,
            dict(raw_org_refs),
            model=Organization,
        )

        logger.info(
            "link_contact_memberships: contacts=%d (stale=%d) families=%d "
            "(stale=%d) organizations=%d (stale=%d)",
            len(contact_refs),
            stale_contact_refs,
            len(family_refs),
            stale_family_refs,
            len(org_refs),
            stale_org_refs,
        )

        family_inserted = 0
        org_inserted = 0
        family_existing = 0
        org_existing = 0
        skipped_no_family_id = 0
        skipped_no_contact_mapping = 0
        skipped_no_parent_mapping = 0
        skipped_stale_contact_ref = 0
        skipped_stale_parent_ref = 0

        for p in rows:
            if not isinstance(p, LegacyPersonRow):
                continue
            if str(p.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if p.deleted_at is not None:
                stats.skipped_deleted += 1
                continue
            if p.family_id is None:
                skipped_no_family_id += 1
                continue

            contact_uuid = contact_refs.get(str(p.legacy_id))
            if contact_uuid is None:
                if str(p.legacy_id) in raw_contact_refs:
                    skipped_stale_contact_ref += 1
                else:
                    skipped_no_contact_mapping += 1
                continue

            fam_key = str(p.family_id)
            family_uuid = family_refs.get(fam_key)
            org_uuid = None if family_uuid is not None else org_refs.get(fam_key)

            if family_uuid is None and org_uuid is None:
                if fam_key in raw_family_refs or fam_key in raw_org_refs:
                    skipped_stale_parent_ref += 1
                else:
                    skipped_no_parent_mapping += 1
                continue

            if family_uuid is not None:
                if _family_membership_exists(
                    session,
                    family_id=family_uuid,
                    contact_id=contact_uuid,
                ):
                    family_existing += 1
                    if dry_run and len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                        stats.row_details.append(
                            self._row_detail(
                                p,
                                action="skip_family_exists",
                                parent_kind="family",
                                parent_uuid=family_uuid,
                                contact_uuid=contact_uuid,
                                dry_run=True,
                            ),
                        )
                    continue
                if not dry_run:
                    session.add(
                        FamilyMember(
                            family_id=family_uuid,
                            contact_id=contact_uuid,
                            role=_family_role(p.kind),
                        ),
                    )
                family_inserted += 1
                stats.inserted += 1
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(p, contact_uuid))
                if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                    stats.row_details.append(
                        self._row_detail(
                            p,
                            action="insert_family",
                            parent_kind="family",
                            parent_uuid=family_uuid,
                            contact_uuid=contact_uuid,
                            dry_run=dry_run,
                        ),
                    )
                continue

            if org_uuid is None:
                raise RuntimeError(
                    "link_contact_memberships: org_uuid unexpectedly None "
                    "after parent mapping resolution",
                )
            if _organization_membership_exists(
                session,
                organization_id=org_uuid,
                contact_id=contact_uuid,
            ):
                org_existing += 1
                if dry_run and len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                    stats.row_details.append(
                        self._row_detail(
                            p,
                            action="skip_org_exists",
                            parent_kind="organization",
                            parent_uuid=org_uuid,
                            contact_uuid=contact_uuid,
                            dry_run=True,
                        ),
                    )
                continue
            if not dry_run:
                session.add(
                    OrganizationMember(
                        organization_id=org_uuid,
                        contact_id=contact_uuid,
                        role=_org_role(p.kind),
                        is_primary_contact=False,
                        title=_title_trim(p.occupation),
                    ),
                )
            org_inserted += 1
            stats.inserted += 1
            if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                stats.preview.append(self.format_preview(p, contact_uuid))
            if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                stats.row_details.append(
                    self._row_detail(
                        p,
                        action="insert_org",
                        parent_kind="organization",
                        parent_uuid=org_uuid,
                        contact_uuid=contact_uuid,
                        dry_run=dry_run,
                    ),
                )

        if not dry_run:
            session.commit()

        stats.diagnostics = {
            "family_memberships_inserted": family_inserted,
            "organization_memberships_inserted": org_inserted,
            "family_memberships_existing": family_existing,
            "organization_memberships_existing": org_existing,
            "skipped_no_family_id": skipped_no_family_id,
            "skipped_no_contact_mapping": skipped_no_contact_mapping,
            "skipped_no_parent_mapping": skipped_no_parent_mapping,
            "skipped_stale_contact_ref": skipped_stale_contact_ref,
            "skipped_stale_parent_ref": skipped_stale_parent_ref,
            "stale_ref_rows_contacts": stale_contact_refs,
            "stale_ref_rows_families": stale_family_refs,
            "stale_ref_rows_organizations": stale_org_refs,
            "dependency_ref_count_contacts": len(contact_refs),
            "dependency_ref_count_families": len(family_refs),
            "dependency_ref_count_organizations": len(org_refs),
        }
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyPersonRow):
            return ""
        fn = (row.first_name or "").strip()
        cid = str(mapped_id) if mapped_id else "…"
        return (
            "Would link: "
            f"legacy_person_id={row.legacy_id} | "
            f"legacy_family_id={row.family_id} | "
            f"contact={cid} | "
            f"name={preview_line(self, fn)!r}"
        )


register(LinkContactMembershipsImporter())
