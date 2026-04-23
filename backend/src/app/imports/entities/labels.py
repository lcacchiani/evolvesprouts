"""Labels entity: legacy ``label`` rows → ``tags``."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Tag
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_event_common import LEGACY_IMPORT_CREATED_BY
from app.imports.entities._legacy_event_common import LegacyLabel
from app.imports.entities._legacy_event_common import parse_legacy_labels
from app.imports.registry import register
from app.imports import refs


class LabelsImporter:
    ENTITY: ClassVar[str] = "labels"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyLabel]:
        return parse_legacy_labels(sql_text)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del dry_run
        return ImporterContext()

    def apply(
        self,
        session: Session,
        rows: Sequence[Any],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        stats = ImportStats(entity=self.ENTITY, dry_run=dry_run)
        q = select(func.lower(Tag.name), Tag.id)
        lower_to_id: dict[str, UUID] = {}
        for ln, tid in session.execute(q).all():
            if ln:
                lower_to_id[str(ln)] = tid if isinstance(tid, UUID) else UUID(str(tid))
        planned_lower: set[str] = set()

        for row in rows:
            if not isinstance(row, LegacyLabel):
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

            name = (row.name or "").strip()
            if not name:
                stats.skipped_invalid += 1
                continue

            ent_l = (row.entity or "").strip().lower()
            if ent_l == "category":
                desc = "legacy category"
            elif ent_l == "tag":
                desc = None
            elif row.entity and str(row.entity).strip():
                desc = f"legacy entity={str(row.entity).strip()}"
            else:
                desc = None
            lk = name.lower()
            existing = lower_to_id.get(lk)

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(row, existing))
                if existing is not None or lk in planned_lower:
                    stats.skipped_duplicate += 1
                else:
                    stats.inserted += 1
                    planned_lower.add(lk)
                continue

            if existing is not None:
                refs.record_mapping(
                    session,
                    self.ENTITY,
                    str(row.legacy_id),
                    existing,
                )
                continue

            tag = Tag(
                name=name,
                color=None,
                description=desc,
                created_by=LEGACY_IMPORT_CREATED_BY,
            )
            session.add(tag)
            session.flush()
            tid = tag.id
            tag_uuid = tid if isinstance(tid, UUID) else UUID(str(tid))
            lower_to_id[lk] = tag_uuid
            refs.record_mapping(session, self.ENTITY, str(row.legacy_id), tag_uuid)
            stats.inserted += 1

        if not dry_run:
            session.commit()
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyLabel):
            return ""
        return (
            f"Would import label id={row.legacy_id} name={preview_line(self, row.name or '')!r} "
            f"entity={row.entity!r}"
        )


register(LabelsImporter())
