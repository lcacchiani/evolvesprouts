"""Split ``contacts.phone`` into ISO region + national number; drop legacy column.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed does not reference ``contacts.phone``; no seed update required.
2. NOT NULL: new columns are nullable.
3. Renamed/dropped: ``phone`` removed; seed unaffected.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

Idempotency: if ``phone`` was already dropped, upgrade skips backfill and only ensures
indexes and check constraints exist (constraints are added only when missing).

Dry-run: set ``PHONE_MIGRATION_DRY_RUN=true`` to scan legacy ``phone`` values, log
masked per-row warnings and summary counts, then **abort** before any DDL so the
revision is not stamped.
"""

from __future__ import annotations

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.engine import Connection

revision: str = "0033_phone_region"
down_revision: Union[str, None] = "0032_services_booking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BATCH_SIZE = 500


def _migration_parse_phone(phone: str) -> tuple[str | None, str | None] | None:
    from app.utils.legacy_phone_migration import parse_legacy_contact_phone_for_migration

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
        logger.warning("contacts.phone already absent; dry-run has nothing to scan")
        raise RuntimeError(
            "PHONE_MIGRATION_DRY_RUN is set; unset and re-run to apply migration"
        )

    last_id = None
    while True:
        params: dict[str, object] = {"lim": _BATCH_SIZE}
        if last_id is None:
            q = (
                "SELECT id, phone FROM contacts WHERE phone IS NOT NULL "
                "ORDER BY id ASC LIMIT :lim"
            )
        else:
            q = (
                "SELECT id, phone FROM contacts WHERE phone IS NOT NULL "
                "AND id > :last ORDER BY id ASC LIMIT :lim"
            )
            params["last"] = str(last_id)
        rows = bind.execute(text(q), params).mappings().all()
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
    bind = op.get_bind()
    assert isinstance(bind, Connection)
    insp = sa.inspect(bind)
    names = {c["name"] for c in insp.get_check_constraints("contacts")}
    if "ck_contacts_phone_region_format" not in names:
        op.create_check_constraint(
            "ck_contacts_phone_region_format",
            "contacts",
            sa.text("phone_region IS NULL OR phone_region ~ '^[A-Z]{2}$'"),
        )
    if "ck_contacts_phone_national_digits" not in names:
        op.create_check_constraint(
            "ck_contacts_phone_national_digits",
            "contacts",
            sa.text(
                "phone_national_number IS NULL OR phone_national_number ~ '^[0-9]+$'"
            ),
        )
    if "ck_contacts_phone_pair" not in names:
        op.create_check_constraint(
            "ck_contacts_phone_pair",
            "contacts",
            sa.text(
                "(phone_region IS NULL) = (phone_national_number IS NULL)"
            ),
        )


def upgrade() -> None:
    bind = op.get_bind()
    assert isinstance(bind, Connection)

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
        last_id = None
        while True:
            params: dict[str, object] = {"lim": _BATCH_SIZE}
            if last_id is None:
                q = (
                    "SELECT id, phone FROM contacts WHERE phone IS NOT NULL "
                    "ORDER BY id ASC LIMIT :lim"
                )
            else:
                q = (
                    "SELECT id, phone FROM contacts WHERE phone IS NOT NULL "
                    "AND id > :last ORDER BY id ASC LIMIT :lim"
                )
                params["last"] = str(last_id)
            rows = bind.execute(text(q), params).mappings().all()
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
                    bind.execute(
                        text(
                            "UPDATE contacts SET phone_region = :r, "
                            "phone_national_number = :n WHERE id = :id"
                        ),
                        {"r": region, "n": national, "id": str(row["id"])},
                    )
            if len(rows) < _BATCH_SIZE:
                break

        op.drop_column("contacts", "phone")

    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS contacts_phone_national_number_idx "
            "ON contacts (phone_national_number)"
        )
    )
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS contacts_phone_search_idx "
            "ON contacts (phone_region, phone_national_number)"
        )
    )


def downgrade() -> None:
    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException

    bind = op.get_bind()
    assert isinstance(bind, Connection)

    for name in (
        "ck_contacts_phone_pair",
        "ck_contacts_phone_national_digits",
        "ck_contacts_phone_region_format",
    ):
        op.execute(text(f'ALTER TABLE contacts DROP CONSTRAINT IF EXISTS "{name}"'))

    bind.execute(text("DROP INDEX IF EXISTS contacts_phone_search_idx"))
    bind.execute(text("DROP INDEX IF EXISTS contacts_phone_national_number_idx"))

    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("contacts")}
    if "phone" not in cols:
        op.add_column(
            "contacts",
            sa.Column("phone", sa.String(length=30), nullable=True),
        )

    last_id = None
    while True:
        params: dict[str, object] = {"lim": _BATCH_SIZE}
        if last_id is None:
            q = (
                "SELECT id, phone_region, phone_national_number FROM contacts "
                "WHERE phone_region IS NOT NULL AND phone_national_number IS NOT NULL "
                "ORDER BY id ASC LIMIT :lim"
            )
        else:
            q = (
                "SELECT id, phone_region, phone_national_number FROM contacts "
                "WHERE phone_region IS NOT NULL AND phone_national_number IS NOT NULL "
                "AND id > :last ORDER BY id ASC LIMIT :lim"
            )
            params["last"] = str(last_id)
        rows = bind.execute(text(q), params).mappings().all()
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
            phone_val = (e164 or "")[:30]
            bind.execute(
                text("UPDATE contacts SET phone = :p WHERE id = :id"),
                {"p": phone_val or None, "id": str(row["id"])},
            )
        if len(rows) < _BATCH_SIZE:
            break

    if "phone_national_number" in cols:
        op.drop_column("contacts", "phone_national_number")
    if "phone_region" in cols:
        op.drop_column("contacts", "phone_region")
