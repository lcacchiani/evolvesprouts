"""Read/write ``legacy_import_refs`` (idempotent inserts)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.legacy_import_ref import LegacyImportRef


def record_mapping(
    session: Session,
    entity: str,
    legacy_key: str,
    new_id: UUID,
) -> None:
    """Insert mapping if absent (idempotent; portable across SQLite tests and Postgres)."""
    existing = session.execute(
        select(LegacyImportRef)
        .where(
            LegacyImportRef.entity == entity,
            LegacyImportRef.legacy_key == legacy_key,
        )
        .limit(1)
    ).scalar_one_or_none()
    if existing is not None:
        return
    session.add(
        LegacyImportRef(entity=entity, legacy_key=legacy_key, new_id=new_id),
    )


def load_mapping(session: Session, entity: str) -> dict[str, UUID]:
    """Load all legacy_key → new_id for ``entity``."""
    q = select(LegacyImportRef.legacy_key, LegacyImportRef.new_id).where(
        LegacyImportRef.entity == entity
    )
    return {str(k): v for k, v in session.execute(q).all()}


def has_mapping(session: Session, entity: str) -> bool:
    """Return True if any ref row exists for ``entity``."""
    q = select(LegacyImportRef.entity).where(LegacyImportRef.entity == entity).limit(1)
    return session.execute(q).first() is not None


def get_mapped_new_id(session: Session, entity: str, legacy_key: str) -> UUID | None:
    """Return ``new_id`` for a mapping row if present."""
    row = session.execute(
        select(LegacyImportRef.new_id).where(
            LegacyImportRef.entity == entity,
            LegacyImportRef.legacy_key == legacy_key,
        )
    ).scalar_one_or_none()
    return row


def load_legacy_keys(session: Session, entity: str) -> frozenset[str]:
    """All ``legacy_key`` values for ``entity`` (for idempotent skip detection)."""
    q = select(LegacyImportRef.legacy_key).where(LegacyImportRef.entity == entity)
    return frozenset(str(k) for k in session.execute(q).scalars().all())
