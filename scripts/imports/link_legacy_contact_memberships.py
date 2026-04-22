#!/usr/bin/env python3
"""Backfill family/organization memberships for already-imported contacts.

One-off operational migration. Contacts, families, and organizations have
already been imported via ``scripts/imports/import_legacy_crm.py``, which
recorded legacy-key -> new-UUID mappings in ``legacy_import_refs``. When that
earlier run happened before family/org parents existed in the refs table, some
contacts ended up without ``family_members`` / ``organization_members`` rows.

This script re-reads a legacy mysqldump and, using the existing
``legacy_import_refs`` mappings, inserts any missing membership rows that link
each contact to its respective family or organization. It never creates new
contacts/families/organizations; it only links the existing ones.

Usage::

    export DATABASE_URL=postgresql://...
    python scripts/imports/link_legacy_contact_memberships.py /path/to/backup.sql
    python scripts/imports/link_legacy_contact_memberships.py /path/to/backup.sql --dry-run

Environment: ``DATABASE_URL`` (required), ``DATABASE_SSLMODE`` (optional, default ``require``).
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

_BACKEND_SRC = Path(__file__).resolve().parents[2] / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import FamilyMember, OrganizationMember
from app.imports import refs
from app.imports.entities._legacy_family_common import (
    LegacyPersonRow,
    parse_legacy_person_rows,
)
from app.imports.entities.contacts import _family_role, _org_role, _title_trim
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


@dataclass
class LinkStats:
    """Counters for a one-off membership backfill run."""

    persons_total: int = 0
    skipped_deleted: int = 0
    skipped_no_family_id: int = 0
    skipped_no_contact_mapping: int = 0
    skipped_no_parent_mapping: int = 0
    family_memberships_inserted: int = 0
    organization_memberships_inserted: int = 0
    family_memberships_existing: int = 0
    organization_memberships_existing: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "persons_total": self.persons_total,
            "skipped_deleted": self.skipped_deleted,
            "skipped_no_family_id": self.skipped_no_family_id,
            "skipped_no_contact_mapping": self.skipped_no_contact_mapping,
            "skipped_no_parent_mapping": self.skipped_no_parent_mapping,
            "family_memberships_inserted": self.family_memberships_inserted,
            "organization_memberships_inserted": self.organization_memberships_inserted,
            "family_memberships_existing": self.family_memberships_existing,
            "organization_memberships_existing": self.organization_memberships_existing,
        }


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


def link_memberships(
    session: Session,
    persons: list[LegacyPersonRow],
    *,
    dry_run: bool,
) -> LinkStats:
    """Insert missing memberships for already-imported contacts.

    Membership inserts are idempotent: existing ``(family_id, contact_id)`` or
    ``(organization_id, contact_id)`` rows are left untouched.
    """
    stats = LinkStats()

    contact_refs = refs.load_mapping(session, "contacts")
    family_refs = refs.load_mapping(session, "families")
    org_refs = refs.load_mapping(session, "organizations")

    logger.info(
        "Loaded legacy_import_refs counts: contacts=%d families=%d organizations=%d",
        len(contact_refs),
        len(family_refs),
        len(org_refs),
    )

    for person in persons:
        stats.persons_total += 1

        if person.deleted_at is not None:
            stats.skipped_deleted += 1
            continue

        if person.family_id is None:
            stats.skipped_no_family_id += 1
            continue

        contact_uuid = contact_refs.get(str(person.legacy_id))
        if contact_uuid is None:
            stats.skipped_no_contact_mapping += 1
            logger.debug(
                "No contact mapping for legacy person id=%s; skipping",
                person.legacy_id,
            )
            continue

        fam_key = str(person.family_id)
        family_uuid = family_refs.get(fam_key)
        org_uuid = None if family_uuid is not None else org_refs.get(fam_key)

        if family_uuid is None and org_uuid is None:
            stats.skipped_no_parent_mapping += 1
            logger.debug(
                "No family/org mapping for legacy family_id=%s "
                "(legacy person id=%s); skipping",
                fam_key,
                person.legacy_id,
            )
            continue

        if family_uuid is not None:
            if _family_membership_exists(
                session,
                family_id=family_uuid,
                contact_id=contact_uuid,
            ):
                stats.family_memberships_existing += 1
                continue
            if not dry_run:
                session.add(
                    FamilyMember(
                        family_id=family_uuid,
                        contact_id=contact_uuid,
                        role=_family_role(person.kind),
                    ),
                )
            stats.family_memberships_inserted += 1
            continue

        assert org_uuid is not None  # for type-narrowing
        if _organization_membership_exists(
            session,
            organization_id=org_uuid,
            contact_id=contact_uuid,
        ):
            stats.organization_memberships_existing += 1
            continue
        if not dry_run:
            session.add(
                OrganizationMember(
                    organization_id=org_uuid,
                    contact_id=contact_uuid,
                    role=_org_role(person.kind),
                    title=_title_trim(person.occupation),
                ),
            )
        stats.organization_memberships_inserted += 1

    if not dry_run:
        session.commit()

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill family_members / organization_members rows for "
            "already-imported legacy contacts using legacy_import_refs."
        ),
    )
    parser.add_argument(
        "sql_path",
        type=Path,
        help="Path to local legacy MariaDB/MySQL .sql dump.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and plan links but do not commit writes.",
    )
    args = parser.parse_args()
    path: Path = args.sql_path
    if not path.is_file():
        logger.error("File not found: %s", path)
        return 1

    sql_text = path.read_text(encoding="utf-8", errors="replace")
    persons = parse_legacy_person_rows(sql_text)
    logger.info("Parsed legacy person rows: %d", len(persons))

    engine = get_engine(use_cache=False)
    with Session(engine) as session:
        stats = link_memberships(session, persons, dry_run=args.dry_run)

    logger.info(
        "Done link_legacy_contact_memberships dry_run=%s %s",
        args.dry_run,
        stats.as_dict(),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
