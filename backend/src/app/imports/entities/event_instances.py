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
            select(ServiceInstance.id)
            .where(ServiceInstance.slug == candidate)
            .limit(1),
        ).first()
        if exists_row is None:
            return candidate
    return None


class EventInstancesImporter:
    ENTITY: ClassVar[str] = "event_instances"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = (
        "event_services",
        "venues",
        "organizations",
    )
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyEventDate]:
        return parse_legacy_event_dates(sql_text)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del dry_run
        svc_ids: list[UUID] = []
        if refs.has_mapping(session, "event_services"):
            for _, sid in refs.load_mapping(session, "event_services").items():
                svc_ids.append(sid if isinstance(sid, UUID) else UUID(str(sid)))
        slug_by: dict[str, str] = {}
        if not svc_ids:
            return ImporterContext()
        rows = session.execute(
            select(Service.id, Service.slug).where(Service.id.in_(svc_ids)),
        ).all()
        for sid, slug in rows:
            if slug:
                key = str(sid if isinstance(sid, UUID) else UUID(str(sid)))
                slug_by[key] = str(slug).strip()
        return ImporterContext(event_service_slug_by_uuid=slug_by)

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
        org_refs = dict(ctx.refs_by_entity.get("organizations", {}))
        if not org_refs and refs.has_mapping(session, "organizations"):
            org_refs = dict(refs.load_mapping(session, "organizations"))

        slug_by_uuid = dict(ctx.event_service_slug_by_uuid)
        if not slug_by_uuid and svc_refs and not dry_run:
            svc_ids = [
                v if isinstance(v, UUID) else UUID(str(v)) for v in svc_refs.values()
            ]
            if svc_ids:
                for sid, slug in session.execute(
                    select(Service.id, Service.slug).where(Service.id.in_(svc_ids)),
                ).all():
                    if slug:
                        key = str(sid if isinstance(sid, UUID) else UUID(str(sid)))
                        slug_by_uuid[key] = str(slug).strip()

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

            if ed.starts_at is None or ed.ends_at is None or ed.starts_at >= ed.ends_at:
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

            svc_key = str(
                svc_uuid if isinstance(svc_uuid, UUID) else UUID(str(svc_uuid)),
            )
            base_slug = slug_by_uuid.get(svc_key, "")
            slug_out: str | None = None
            if base_slug and ed.starts_at is not None:
                ymd = ed.starts_at.strftime("%Y%m%d")
                base = f"{base_slug}-{ymd}"
                if dry_run:
                    slug_out = base
                else:
                    slug_out = _allocate_instance_slug(session, base)

            legacy_org_id = event_org.get(ed.event_id)
            partner_org_uuid: UUID | None = None
            if legacy_org_id is not None:
                partner_org_uuid = org_refs.get(str(legacy_org_id))
                if partner_org_uuid is None:
                    stats.partner_org_skipped_unmapped += 1

            title_preview = f"event_date {ed.legacy_id} for event {ed.event_id}"
            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    slug_disp = slug_out or "null"
                    stats.preview.append(
                        f"Would import {title_preview} status={status.value} "
                        f"location={'set' if loc_uuid else 'null'} slug={slug_disp}",
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
                cohort=None,
                notes=(str(ed.notes).strip() if ed.notes else None) or None,
                external_url=(str(ed.external_url).strip() if ed.external_url else None)
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

            if partner_org_uuid is not None:
                session.add(
                    ServiceInstancePartnerOrganization(
                        service_instance_id=inst_uuid,
                        organization_id=partner_org_uuid,
                        sort_order=0,
                    ),
                )
                stats.partner_org_links_inserted += 1

            refs.record_mapping(session, self.ENTITY, str(ed.legacy_id), inst_uuid)
            stats.inserted += 1

        if not dry_run:
            session.commit()
        stats.diagnostics = {
            "partner_org_links_inserted": stats.partner_org_links_inserted,
            "partner_org_skipped_unmapped": stats.partner_org_skipped_unmapped,
        }
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyEventDate):
            return ""
        return preview_line(
            self,
            f"Would import event_date id={row.legacy_id} event_id={row.event_id}",
        )


register(EventInstancesImporter())
