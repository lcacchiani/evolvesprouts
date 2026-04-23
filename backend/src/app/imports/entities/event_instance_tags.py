"""Junction: legacy ``event_label`` → ``service_instance_tags``."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import exists
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ServiceInstance
from app.db.models import ServiceInstanceTag
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_event_common import LegacyEventLabel
from app.imports.entities._legacy_event_common import parse_legacy_event_labels
from app.imports.registry import register


class EventInstanceTagsImporter:
    ENTITY: ClassVar[str] = "event_instance_tags"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("event_instances", "labels")
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyEventLabel]:
        return parse_legacy_event_labels(sql_text)

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
        inst_refs = ctx.refs_by_entity.get("event_instances", {})
        svc_refs = ctx.refs_by_entity.get("event_services", {})
        label_refs = ctx.refs_by_entity.get("labels", {})

        for jl in rows:
            if not isinstance(jl, LegacyEventLabel):
                continue
            tag_uuid = label_refs.get(str(jl.label_id))
            if tag_uuid is None:
                stats.skipped_no_dep += 1
                continue

            instance_ids: list[UUID] = []
            if jl.event_date_id is not None:
                iu = inst_refs.get(str(jl.event_date_id))
                if iu is not None:
                    instance_ids.append(iu)
            elif jl.event_id is not None:
                svc_uuid = svc_refs.get(str(jl.event_id))
                if svc_uuid is not None:
                    q = select(ServiceInstance.id).where(
                        ServiceInstance.service_id == svc_uuid,
                    )
                    instance_ids = [
                        r if isinstance(r, UUID) else UUID(str(r))
                        for (r,) in session.execute(q).all()
                    ]

            if not instance_ids:
                stats.skipped_no_dep += 1
                continue

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(jl, tag_uuid))
                stats.inserted += len(instance_ids)
                continue

            for inst_uuid in instance_ids:
                already = session.execute(
                    select(
                        exists().where(
                            ServiceInstanceTag.service_instance_id == inst_uuid,
                            ServiceInstanceTag.tag_id == tag_uuid,
                        ),
                    ),
                ).scalar()
                if already:
                    stats.skipped_duplicate += 1
                    continue

                session.add(
                    ServiceInstanceTag(
                        service_instance_id=inst_uuid,
                        tag_id=tag_uuid,
                    ),
                )
                stats.inserted += 1

        if not dry_run:
            session.commit()
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyEventLabel):
            return ""
        return preview_line(
            self,
            f"event_label label_id={row.label_id} "
            f"event_id={row.event_id} event_date_id={row.event_date_id}",
        )


register(EventInstanceTagsImporter())
