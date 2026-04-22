"""Split ``contacts.phone`` into ISO region + national number; drop legacy column.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed does not reference ``contacts.phone``; no seed update required.
2. NOT NULL: new columns are nullable.
3. Renamed/dropped: ``phone`` removed; seed unaffected.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

**Irreversible data on parse failure:** Rows whose legacy ``phone`` cannot be parsed
leave ``phone_region`` / ``phone_national_number`` as NULL and the legacy column is
then dropped. **Downgrade cannot recover** those values (the old string is gone).
Operators who need rollback fidelity must export or fix ``contacts.phone`` before
upgrade.

**Backfill vs read-time formatting:** Migration backfill uses
``phonenumbers.is_possible_number`` (soft gate) so borderline legacy strings are not
discarded. API read paths format E.164 / international using
``is_valid_number OR is_possible_number`` so those stored rows still display.

Idempotency: if ``phone`` was already dropped, upgrade skips backfill and only ensures
indexes and check constraints exist (constraints are added only when missing).

Dry-run: set ``PHONE_MIGRATION_DRY_RUN=true`` to scan legacy ``phone`` values, log
masked per-row warnings and summary counts, then **abort** before any DDL so the
revision is not stamped. If ``contacts.phone`` is already absent, dry-run exits with
a message that there is nothing to assess (upgrade would also skip backfill).
"""

from __future__ import annotations

import os
from typing import Sequence, Union, cast

import sqlalchemy as sa
from alembic import op
from sqlalchemy import and_, or_, select, update
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.engine import Connection

revision: str = "0033_phone_region"
down_revision: Union[str, None] = "0032_services_booking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BATCH_SIZE = 500

_CONTACTS = sa.table(
    "contacts",
    sa.column("id", PG_UUID(as_uuid=True)),
    sa.column("phone", sa.String(length=30)),
    sa.column("phone_region", sa.String(length=2)),
    sa.column("phone_national_number", sa.String(length=20)),
)


def _migration_parse_phone(phone: str) -> tuple[str | None, str | None] | None:
    from app.utils.legacy_phone_migration import (
        parse_legacy_contact_phone_for_migration,
    )

    return parse_legacy_contact_phone_for_migration(phone)


def _dry_run_analysis(bind: Connection) -> None:
    from app.utils.logging import get_logger, mask_pii

    logger = get_logger("alembic.0033_phone_region")
    insp = sa.inspect(bind)
    parseable = 0
    unparseable = 0
    if "contacts" not in insp.get_table_names():
        logger.warning("contacts table missing; dry-run has nothing to scan")
        raise RuntimeError(
            "PHONE_MIGRATION_DRY_RUN is set; unset and re-run to apply migration"
        )
    col_names = {c["name"] for c in insp.get_columns("contacts")}
    if "phone" not in col_names:
        logger.warning(
            "contacts.phone already absent; dry-run has nothing to scan "
            "(upgrade backfill would also be skipped)"
        )
        raise RuntimeError(
            "PHONE_MIGRATION_DRY_RUN: nothing to assess (legacy phone column already "
            "removed). Unset PHONE_MIGRATION_DRY_RUN — no migration action pending."
        )

    last_id: object | None = None
    while True:
        if last_id is None:
            stmt = (
                select(_CONTACTS.c.id, _CONTACTS.c.phone)
                .where(_CONTACTS.c.phone.is_not(None))
                .order_by(_CONTACTS.c.id.asc())
                .limit(_BATCH_SIZE)
            )
            rows = bind.execute(stmt).mappings().all()
        else:
            stmt = (
                select(_CONTACTS.c.id, _CONTACTS.c.phone)
                .where(
                    _CONTACTS.c.phone.is_not(None),
                    _CONTACTS.c.id > last_id,
                )
                .order_by(_CONTACTS.c.id.asc())
                .limit(_BATCH_SIZE)
            )
            rows = bind.execute(stmt).mappings().all()
        if not rows:
            break
        for row in rows:
            last_id = row["id"]
            phone_raw = row["phone"]
            if phone_raw is None or str(phone_raw).strip() == "":
                continue
            phone_str = str(phone_raw).strip()
            if _migration_parse_phone(phone_str) is None:
                unparseable += 1
                logger.warning(
                    "contacts phone migration dry-run: could not parse legacy phone",
                    extra={"contact_id": str(row["id"]), "phone": mask_pii(phone_str)},
                )
            else:
                parseable += 1
        if len(rows) < _BATCH_SIZE:
            break

    logger.warning(
        "PHONE_MIGRATION_DRY_RUN complete (parseable=%s unparseable=%s); "
        "aborting before DDL",
        parseable,
        unparseable,
        extra={"parseable": parseable, "unparseable": unparseable},
    )
    raise RuntimeError(
        "PHONE_MIGRATION_DRY_RUN is set; unset and re-run to apply migration"
    )


def _ensure_check_constraints() -> None:
    bind = cast(Connection, op.get_bind())
    insp = sa.inspect(bind)
    names = {c["name"] for c in insp.get_check_constraints("contacts")}
    c = _CONTACTS.c
    if "ck_contacts_phone_region_format" not in names:
        region_ok = or_(
            c.phone_region.is_(None),
            c.phone_region.regexp_match("^[A-Z]{2}$"),
        )
        op.create_check_constraint(
            "ck_contacts_phone_region_format",
            "contacts",
            region_ok,
        )
    if "ck_contacts_phone_national_digits" not in names:
        national_ok = or_(
            c.phone_national_number.is_(None),
            c.phone_national_number.regexp_match("^[0-9]+$"),
        )
        op.create_check_constraint(
            "ck_contacts_phone_national_digits",
            "contacts",
            national_ok,
        )
    if "ck_contacts_phone_pair" not in names:
        pair_ok = or_(
            and_(c.phone_region.is_(None), c.phone_national_number.is_(None)),
            and_(c.phone_region.is_not(None), c.phone_national_number.is_not(None)),
        )
        op.create_check_constraint(
            "ck_contacts_phone_pair",
            "contacts",
            pair_ok,
        )


def upgrade() -> None:
    bind = cast(Connection, op.get_bind())

    dry_run = os.environ.get("PHONE_MIGRATION_DRY_RUN", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if dry_run:
        _dry_run_analysis(bind)

    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("contacts")}

    if "phone_region" not in cols:
        op.add_column(
            "contacts",
            sa.Column("phone_region", sa.String(length=2), nullable=True),
        )
    if "phone_national_number" not in cols:
        op.add_column(
            "contacts",
            sa.Column("phone_national_number", sa.String(length=20), nullable=True),
        )

    _ensure_check_constraints()

    has_phone = "phone" in cols
    if has_phone:
        from app.utils.logging import get_logger, mask_pii

        logger = get_logger("alembic.0033_phone_region")
        last_id: object | None = None
        while True:
            if last_id is None:
                stmt = (
                    select(_CONTACTS.c.id, _CONTACTS.c.phone)
                    .where(_CONTACTS.c.phone.is_not(None))
                    .order_by(_CONTACTS.c.id.asc())
                    .limit(_BATCH_SIZE)
                )
                rows = bind.execute(stmt).mappings().all()
            else:
                stmt = (
                    select(_CONTACTS.c.id, _CONTACTS.c.phone)
                    .where(
                        _CONTACTS.c.phone.is_not(None),
                        _CONTACTS.c.id > last_id,
                    )
                    .order_by(_CONTACTS.c.id.asc())
                    .limit(_BATCH_SIZE)
                )
                rows = bind.execute(stmt).mappings().all()
            if not rows:
                break
            for row in rows:
                last_id = row["id"]
                phone_raw = row["phone"]
                if phone_raw is None or str(phone_raw).strip() == "":
                    continue
                phone_str = str(phone_raw).strip()
                outcome = _migration_parse_phone(phone_str)
                if outcome is None:
                    logger.warning(
                        "contacts phone migration: could not parse legacy phone",
                        extra={
                            "contact_id": str(row["id"]),
                            "phone": mask_pii(phone_str),
                        },
                    )
                else:
                    region, national = outcome
                    upd = (
                        update(_CONTACTS)
                        .where(_CONTACTS.c.id == sa.bindparam("cid"))
                        .values(
                            phone_region=sa.bindparam("r"),
                            phone_national_number=sa.bindparam("n"),
                        )
                    )
                    bind.execute(
                        upd,
                        {"cid": row["id"], "r": region, "n": national},
                    )
            if len(rows) < _BATCH_SIZE:
                break

        op.drop_column("contacts", "phone")

    op.create_index(
        "contacts_phone_national_number_idx",
        "contacts",
        ["phone_national_number"],
        if_not_exists=True,
    )
    op.create_index(
        "contacts_phone_search_idx",
        "contacts",
        ["phone_region", "phone_national_number"],
        if_not_exists=True,
    )


def downgrade() -> None:
    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException

    bind = cast(Connection, op.get_bind())

    for name in (
        "ck_contacts_phone_pair",
        "ck_contacts_phone_national_digits",
        "ck_contacts_phone_region_format",
    ):
        op.drop_constraint(name, "contacts", type_="check", if_exists=True)

    op.drop_index(
        "contacts_phone_search_idx",
        table_name="contacts",
        if_exists=True,
    )
    op.drop_index(
        "contacts_phone_national_number_idx",
        table_name="contacts",
        if_exists=True,
    )

    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("contacts")}
    if "phone" not in cols:
        op.add_column(
            "contacts",
            sa.Column("phone", sa.String(length=30), nullable=True),
        )

    last_id: object | None = None
    while True:
        if last_id is None:
            stmt = (
                select(
                    _CONTACTS.c.id,
                    _CONTACTS.c.phone_region,
                    _CONTACTS.c.phone_national_number,
                )
                .where(
                    _CONTACTS.c.phone_region.is_not(None),
                    _CONTACTS.c.phone_national_number.is_not(None),
                )
                .order_by(_CONTACTS.c.id.asc())
                .limit(_BATCH_SIZE)
            )
            rows = bind.execute(stmt).mappings().all()
        else:
            stmt = (
                select(
                    _CONTACTS.c.id,
                    _CONTACTS.c.phone_region,
                    _CONTACTS.c.phone_national_number,
                )
                .where(
                    _CONTACTS.c.phone_region.is_not(None),
                    _CONTACTS.c.phone_national_number.is_not(None),
                    _CONTACTS.c.id > last_id,
                )
                .order_by(_CONTACTS.c.id.asc())
                .limit(_BATCH_SIZE)
            )
            rows = bind.execute(stmt).mappings().all()
        if not rows:
            break
        for row in rows:
            last_id = row["id"]
            region = str(row["phone_region"])
            national = str(row["phone_national_number"])
            try:
                parsed = phonenumbers.parse(national, region)
                e164 = phonenumbers.format_number(
                    parsed, phonenumbers.PhoneNumberFormat.E164
                )
            except NumberParseException:
                e164 = ""
            # E.164 max length is 15 digits + leading '+' (≤16); column is varchar(30).
            phone_val = (e164 or "")[:30]
            upd = (
                update(_CONTACTS)
                .where(_CONTACTS.c.id == sa.bindparam("cid"))
                .values(phone=sa.bindparam("p"))
            )
            bind.execute(upd, {"cid": row["id"], "p": phone_val or None})
        if len(rows) < _BATCH_SIZE:
            break

    if "phone_national_number" in cols:
        op.drop_column("contacts", "phone_national_number")
    if "phone_region" in cols:
        op.drop_column("contacts", "phone_region")
