"""Event templates: legacy ``event`` → ``services`` + ``event_details``."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import EventDetails
from app.db.models import Service
from app.db.models.enums import ServiceStatus
from app.db.models.enums import ServiceType
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_event_common import LEGACY_IMPORT_CREATED_BY
from app.imports.entities._legacy_event_common import LegacyEvent
from app.imports.entities._legacy_event_common import _infer_delivery_mode
from app.imports.entities._legacy_event_common import _map_event_category
from app.imports.entities._legacy_event_common import _normalize_currency
from app.imports.entities._legacy_event_common import _slugify_event_title
from app.imports.entities._legacy_event_common import parse_legacy_events
from app.imports.registry import register
from app.imports import refs


def _slug_fits(slug: str) -> bool:
    return 0 < len(slug) <= 80


def _allocate_service_slug(session: Session, base: str) -> str | None:
    if not _slug_fits(base):
        return None
    for n in range(10):
        candidate = base if n == 0 else f"{base}-{n + 1}"
        if not _slug_fits(candidate):
            return None
        cnt = session.execute(
            select(func.count()).select_from(Service).where(Service.slug == candidate),
        ).scalar_one()
        if int(cnt or 0) == 0:
            return candidate
    return None


class EventServicesImporter:
    ENTITY: ClassVar[str] = "event_services"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("venues", "organizations", "labels")
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyEvent]:
        return parse_legacy_events(sql_text)

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

        for ev in rows:
            if not isinstance(ev, LegacyEvent):
                continue
            if str(ev.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if ev.deleted_at is not None:
                stats.skipped_deleted += 1
                continue
            if str(ev.legacy_id) in ctx.existing_import_keys:
                stats.skipped_duplicate += 1
                continue

            title = (ev.title or "").strip()
            if not title:
                stats.skipped_invalid_title += 1
                continue

            cat = _map_event_category(ev.category)
            delivery = _infer_delivery_mode(
                title,
                str(ev.description) if ev.description else None,
                ev.default_venue_name,
            )
            currency = _normalize_currency(ev.default_currency, default="HKD") or "HKD"

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(
                        f"Would import event id={ev.legacy_id} title={preview_line(self, title)!r} "
                        f"event_category={cat.value} delivery_mode={delivery.value}",
                    )
                stats.inserted += 1
                continue

            slug_base = _slugify_event_title(title)
            slug = _allocate_service_slug(session, slug_base) if slug_base else None

            svc = Service(
                service_type=ServiceType.EVENT,
                title=title,
                slug=slug,
                description=str(ev.description).strip() if ev.description else None,
                cover_image_s3_key=None,
                delivery_mode=delivery,
                status=ServiceStatus.DRAFT,
                booking_system=None,
                created_by=LEGACY_IMPORT_CREATED_BY,
            )
            session.add(svc)
            session.flush()
            sid = svc.id
            svc_uuid = sid if isinstance(sid, UUID) else UUID(str(sid))

            session.add(
                EventDetails(
                    service_id=svc_uuid,
                    event_category=cat,
                    default_price=ev.default_price,
                    default_currency=currency,
                ),
            )
            refs.record_mapping(session, self.ENTITY, str(ev.legacy_id), svc_uuid)
            stats.inserted += 1

        if not dry_run:
            session.commit()
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyEvent):
            return ""
        t = (row.title or "").strip()
        cat = _map_event_category(row.category)
        dm = _infer_delivery_mode(
            t,
            str(row.description) if row.description else None,
            row.default_venue_name,
        )
        return (
            f"Would import event id={row.legacy_id} title={preview_line(self, t)!r} "
            f"event_category={cat.value} delivery_mode={dm.value}"
        )


register(EventServicesImporter())
