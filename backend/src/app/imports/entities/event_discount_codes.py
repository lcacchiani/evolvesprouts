"""Discount codes: legacy ``discount`` → ``discount_codes``."""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DiscountCode
from app.db.models.enums import DiscountType
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_event_common import LEGACY_IMPORT_CREATED_BY
from app.imports.entities._legacy_event_common import LegacyDiscount
from app.imports.entities._legacy_event_common import _map_discount_type
from app.imports.entities._legacy_event_common import _parse_dt_utc_assumed
from app.imports.entities._legacy_event_common import parse_legacy_discounts
from app.imports.registry import register
from app.imports import refs
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _discount_value_valid(dtype: DiscountType, value: Decimal | None) -> bool:
    if value is None:
        return False
    if dtype == DiscountType.REFERRAL:
        return value >= 0
    return value > 0


class EventDiscountCodesImporter:
    ENTITY: ClassVar[str] = "event_discount_codes"
    #: Refs for scoped rows are loaded opportunistically in ``apply`` so global codes
    #: can import before ``event_services`` / ``event_instances`` exist.
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyDiscount]:
        return parse_legacy_discounts(sql_text)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del dry_run
        return ImporterContext()

    def _existing_by_code(self, session: Session, code: str) -> UUID | None:
        q = select(DiscountCode.id).where(
            func.lower(DiscountCode.code) == func.lower(code),
        )
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
        svc_refs = (
            ctx.refs_by_entity.get("event_services", {})
            if ctx.refs_by_entity.get("event_services")
            else (
                refs.load_mapping(session, "event_services")
                if refs.has_mapping(session, "event_services")
                else {}
            )
        )
        inst_refs = (
            ctx.refs_by_entity.get("event_instances", {})
            if ctx.refs_by_entity.get("event_instances")
            else (
                refs.load_mapping(session, "event_instances")
                if refs.has_mapping(session, "event_instances")
                else {}
            )
        )

        for d in rows:
            if not isinstance(d, LegacyDiscount):
                continue
            if str(d.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if d.deleted_at is not None:
                stats.skipped_deleted += 1
                continue
            if str(d.legacy_id) in ctx.existing_import_keys:
                stats.skipped_duplicate += 1
                continue

            raw_code = (str(d.code).strip() if d.code else "") or ""
            if not raw_code:
                stats.skipped_invalid += 1
                continue
            code = raw_code.upper()

            dtype = _map_discount_type(d.type)
            if dtype is None:
                logger.warning("unknown legacy discount.type=%r; skipping", d.type)
                stats.skipped_invalid += 1
                continue

            val = d.value
            if not _discount_value_valid(dtype, val):
                logger.warning(
                    "discount id=%s invalid value for type=%s: %r",
                    d.legacy_id,
                    dtype.value,
                    val,
                )
                stats.skipped_invalid += 1
                continue

            svc_uuid: UUID | None = None
            inst_uuid: UUID | None = None
            if d.event_date_id is not None:
                inst_uuid = inst_refs.get(str(d.event_date_id))
                if inst_uuid is None:
                    stats.skipped_no_dep += 1
                    continue
            elif d.event_id is not None:
                svc_uuid = svc_refs.get(str(d.event_id))
                if svc_uuid is None:
                    stats.skipped_no_dep += 1
                    continue

            vf = _parse_dt_utc_assumed(d.valid_from)
            vt = _parse_dt_utc_assumed(d.valid_to)

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(
                        preview_line(
                            self,
                            f"Would import discount id={d.legacy_id} code={code} "
                            f"type={dtype.value} scope="
                            f"{'instance' if inst_uuid else 'service' if svc_uuid else 'global'}",
                        ),
                    )
                stats.inserted += 1
                continue

            existing = self._existing_by_code(session, code)
            if existing is not None:
                refs.record_mapping(session, self.ENTITY, str(d.legacy_id), existing)
                stats.inserted += 1
                continue

            dc = DiscountCode(
                code=code,
                description=None,
                discount_type=dtype,
                discount_value=val if val is not None else Decimal("0"),
                currency=None,
                valid_from=vf,
                valid_until=vt,
                service_id=svc_uuid,
                instance_id=inst_uuid,
                max_uses=d.max_uses,
                created_by=LEGACY_IMPORT_CREATED_BY,
            )
            session.add(dc)
            session.flush()
            did = dc.id
            new_uuid = did if isinstance(did, UUID) else UUID(str(did))
            refs.record_mapping(session, self.ENTITY, str(d.legacy_id), new_uuid)
            stats.inserted += 1

        if not dry_run:
            session.commit()
        return stats

    def format_preview(self, row: object, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyDiscount):
            return ""
        c = str(row.code).strip().upper() if row.code else ""
        return preview_line(
            self, f"Would import discount id={row.legacy_id} code={c!r}"
        )


register(EventDiscountCodesImporter())
