"""Enrollments: legacy ``registration`` → ``enrollments``."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC
from datetime import datetime
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Enrollment
from app.db.models.enums import EnrollmentStatus
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_event_common import LEGACY_IMPORT_CREATED_BY
from app.imports.entities._legacy_event_common import LegacyRegistration
from app.imports.entities._legacy_event_common import _map_enrollment_status
from app.imports.entities._legacy_event_common import _normalize_currency
from app.imports.entities._legacy_event_common import _parse_dt
from app.imports.entities._legacy_event_common import parse_legacy_registrations
from app.imports.registry import register
from app.imports import refs
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _amount_paid_for_status(
    status: EnrollmentStatus,
    price: Any,
) -> Any:
    if status in (EnrollmentStatus.CONFIRMED, EnrollmentStatus.COMPLETED):
        return price
    return None


class EventEnrollmentsImporter:
    ENTITY: ClassVar[str] = "event_enrollments"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = (
        "event_instances",
        "contacts",
        "families",
        "organizations",
    )
    PII: ClassVar[bool] = True
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyRegistration]:
        return parse_legacy_registrations(sql_text)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del dry_run
        return ImporterContext()

    def _find_existing_enrollment(
        self,
        session: Session,
        *,
        instance_id: UUID,
        contact_id: UUID | None,
        family_id: UUID | None,
        organization_id: UUID | None,
    ) -> UUID | None:
        if contact_id is not None:
            q = select(Enrollment.id).where(
                Enrollment.instance_id == instance_id,
                Enrollment.contact_id == contact_id,
            )
        elif family_id is not None:
            q = select(Enrollment.id).where(
                Enrollment.instance_id == instance_id,
                Enrollment.family_id == family_id,
            )
        elif organization_id is not None:
            q = select(Enrollment.id).where(
                Enrollment.instance_id == instance_id,
                Enrollment.organization_id == organization_id,
            )
        else:
            return None
        row = session.execute(q.limit(1)).scalar_one_or_none()
        if row is None:
            return None
        return row if isinstance(row, UUID) else UUID(str(row))

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
        contact_refs = ctx.refs_by_entity.get("contacts", {})
        fam_refs = ctx.refs_by_entity.get("families", {})
        org_refs = ctx.refs_by_entity.get("organizations", {})
        disc_refs = ctx.refs_by_entity.get("event_discount_codes", {})
        if not disc_refs and refs.has_mapping(session, "event_discount_codes"):
            disc_refs = refs.load_mapping(session, "event_discount_codes")

        for reg in rows:
            if not isinstance(reg, LegacyRegistration):
                continue
            if str(reg.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if reg.deleted_at is not None:
                stats.skipped_deleted += 1
                continue
            if str(reg.legacy_id) in ctx.existing_import_keys:
                stats.skipped_duplicate += 1
                continue

            if reg.event_date_id is None:
                stats.skipped_no_dep += 1
                continue
            inst_uuid = inst_refs.get(str(reg.event_date_id))
            if inst_uuid is None:
                stats.skipped_no_dep += 1
                continue

            contact_uuid: UUID | None = None
            family_uuid: UUID | None = None
            org_uuid: UUID | None = None
            if reg.person_id is not None:
                contact_uuid = contact_refs.get(str(reg.person_id))
            if contact_uuid is None and reg.family_id is not None:
                family_uuid = fam_refs.get(str(reg.family_id))
            if contact_uuid is None and family_uuid is None and reg.organization_id is not None:
                org_uuid = org_refs.get(str(reg.organization_id))

            if contact_uuid is None and family_uuid is None and org_uuid is None:
                logger.warning(
                    "Skipping anonymous registration legacy_id=%s (no contact/family/org ref)",
                    reg.legacy_id,
                )
                stats.skipped_no_dep += 1
                continue

            status = _map_enrollment_status(reg.status)
            amount = _amount_paid_for_status(status, reg.price)
            currency = _normalize_currency(reg.currency, default=None)
            enrolled_at = reg.created_at or datetime.now(UTC)
            cancelled_at = _parse_dt(reg.cancelled_at)
            if cancelled_at is not None and cancelled_at.tzinfo is None:
                cancelled_at = cancelled_at.replace(tzinfo=UTC)
            discount_uuid: UUID | None = None
            if reg.discount_id is not None:
                discount_uuid = disc_refs.get(str(reg.discount_id))

            existing_id = self._find_existing_enrollment(
                session,
                instance_id=inst_uuid,
                contact_id=contact_uuid,
                family_id=family_uuid,
                organization_id=org_uuid,
            )

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(reg, existing_id))
                if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                    stats.row_details.append(
                        {
                            "legacy_registration_id": reg.legacy_id,
                            "instance_id": str(inst_uuid),
                            "status": status.value,
                        },
                    )
                if existing_id is not None:
                    stats.reused_existing_enrollment += 1
                else:
                    stats.inserted += 1
                continue

            if existing_id is not None:
                refs.record_mapping(
                    session,
                    self.ENTITY,
                    str(reg.legacy_id),
                    existing_id,
                )
                stats.reused_existing_enrollment += 1
                continue

            en = Enrollment(
                instance_id=inst_uuid,
                contact_id=contact_uuid,
                family_id=family_uuid,
                organization_id=org_uuid,
                ticket_tier_id=None,
                discount_code_id=discount_uuid,
                status=status,
                amount_paid=amount,
                currency=currency,
                enrolled_at=enrolled_at,
                cancelled_at=cancelled_at,
                notes=(str(reg.notes).strip() if reg.notes else None) or None,
                created_by=LEGACY_IMPORT_CREATED_BY,
            )
            session.add(en)
            session.flush()
            eid = en.id
            en_uuid = eid if isinstance(eid, UUID) else UUID(str(eid))
            refs.record_mapping(session, self.ENTITY, str(reg.legacy_id), en_uuid)
            stats.inserted += 1

        if not dry_run:
            session.commit()
        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyRegistration):
            return ""
        return preview_line(
            self,
            f"Would import registration id={row.legacy_id} event_date_id={row.event_date_id}",
        )


register(EventEnrollmentsImporter())
