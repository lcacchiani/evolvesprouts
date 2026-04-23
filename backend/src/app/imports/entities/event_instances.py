"""Event instances: legacy ``event_date`` → ``service_instances`` + slot + partner org."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC
from datetime import datetime
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import InstanceSessionSlot
from app.db.models import Service
from app.db.models import ServiceInstance
from app.db.models import ServiceInstancePartnerOrganization
from app.db.models.enums import EventbriteSyncStatus
from app.db.models.enums import InstanceStatus
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_event_common import LEGACY_IMPORT_CREATED_BY
from app.imports.entities._legacy_event_common import LegacyEventDate
from app.imports.entities._legacy_event_common import _parse_dt
from app.imports.entities._legacy_event_common import parse_legacy_event_dates
from app.imports.entities._legacy_event_common import parse_legacy_events
from app.imports.registry import register
from app.imports import refs


def _allocate_instance_slug(session: Session, base: str) -> str | None:
    if not base or len(base) > 128:
        return None
    for n in range(10):
        candidate = base if n == 0 else f"{base}-{n + 1}"
        if len(candidate) > 128:
            return None
        exists_row = session.execute(
            select(ServiceInstance.id).where(ServiceInstance.slug == candidate).limit(1),
        ).first()
        if exists_row is None:
            return candidate
    return None


class EventInstancesImporter:
    ENTITY: ClassVar[str] = "event_instances"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("event_services", "venues")
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyEventDate]:
        return parse_legacy_event_dates(sql_text)

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
        svc_refs = ctx.refs_by_entity.get("event_services", {})
        venue_refs = ctx.refs_by_entity.get("venues", {})
        org_refs = ctx.refs_by_entity.get("organizations", {})

        event_org: dict[int, int] = {}
        if ctx.source_sql_text:
            for ev in parse_legacy_events(ctx.source_sql_text):
                if ev.organization_id is not None:
                    event_org[ev.legacy_id] = ev.organization_id

        now = datetime.now(UTC)

        for ed in rows:
            if not isinstance(ed, LegacyEventDate):
                continue
            if str(ed.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if ed.deleted_at is not None:
                stats.skipped_deleted += 1
                continue
            if str(ed.legacy_id) in ctx.existing_import_keys:
                stats.skipped_duplicate += 1
                continue

            if ed.event_id is None:
                stats.skipped_no_dep += 1
                continue
            svc_uuid = svc_refs.get(str(ed.event_id))
            if svc_uuid is None:
                stats.skipped_no_dep += 1
                continue

            if (
                ed.starts_at is None
                or ed.ends_at is None
                or ed.starts_at >= ed.ends_at
            ):
                stats.skipped_invalid_range += 1
                continue

            cancelled_dt = _parse_dt(ed.cancelled_at)
            if cancelled_dt is not None:
                status = InstanceStatus.CANCELLED
            elif ed.ends_at < now:
                status = InstanceStatus.COMPLETED
            else:
                status = InstanceStatus.SCHEDULED

            loc_uuid: UUID | None = None
            if ed.venue_id is not None:
                loc_uuid = venue_refs.get(str(ed.venue_id))
                if loc_uuid is None:
                    stats.skipped_location_unmapped += 1

            cap = ed.capacity
            max_cap = cap if cap is not None and cap > 0 else None

            slug_out: str | None = None
            if not dry_run:
                svc_row = session.get(Service, svc_uuid)
                base_slug = (
                    (svc_row.slug or "").strip()
                    if svc_row is not None and svc_row.slug
                    else ""
                )
                if base_slug:
                    ymd = ed.starts_at.strftime("%Y%m%d")
                    slug_out = _allocate_instance_slug(
                        session,
                        f"{base_slug}-{ymd}",
                    )

            title_preview = f"event_date {ed.legacy_id} for event {ed.event_id}"
            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(
                        f"Would import {title_preview} status={status.value} "
                        f"location={'set' if loc_uuid else 'null'}",
                    )
                stats.inserted += 1
                continue

            inst = ServiceInstance(
                service_id=svc_uuid,
                title=None,
                slug=slug_out,
                description=None,
                cover_image_s3_key=None,
                status=status,
                delivery_mode=None,
                location_id=loc_uuid,
                max_capacity=max_cap,
                waitlist_enabled=False,
                instructor_id=None,
                age_group=None,
                cohort=None,
                notes=(str(ed.notes).strip() if ed.notes else None) or None,
                external_url=(
                    str(ed.external_url).strip() if ed.external_url else None
                )
                or None,
                created_by=LEGACY_IMPORT_CREATED_BY,
                eventbrite_sync_status=EventbriteSyncStatus.PENDING,
            )
            session.add(inst)
            session.flush()
            iid = inst.id
            inst_uuid = iid if isinstance(iid, UUID) else UUID(str(iid))

            session.add(
                InstanceSessionSlot(
                    instance_id=inst_uuid,
                    starts_at=ed.starts_at,
                    ends_at=ed.ends_at,
                    location_id=loc_uuid,
                    sort_order=0,
                ),
            )

            legacy_org_id = event_org.get(ed.event_id)
            if legacy_org_id is not None:
                org_uuid = org_refs.get(str(legacy_org_id))
                if org_uuid is not None:
                    session.add(
                        ServiceInstancePartnerOrganization(
                            service_instance_id=inst_uuid,
                            organization_id=org_uuid,
                            sort_order=0,
                        ),
                    )

            refs.record_mapping(session, self.ENTITY, str(ed.legacy_id), inst_uuid)
            stats.inserted += 1

        if not dry_run:
            session.commit()
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyEventDate):
            return ""
        return preview_line(
            self,
            f"Would import event_date id={row.legacy_id} event_id={row.event_id}",
        )


register(EventInstancesImporter())
