"""Notes entity: legacy ``note`` + ``person_note`` → ``notes`` + ``note_entity_links``."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace
from typing import Any
from typing import ClassVar
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.note import NOTE_ENTITY_TYPE_CONTACT
from app.db.models.note import Note
from app.db.models.note import NoteEntityLink
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import preview_line
from app.imports.entities._legacy_family_common import LegacyNoteRow
from app.imports.entities._legacy_family_common import note_id_to_person_ids
from app.imports.entities._legacy_family_common import parse_legacy_notes
from app.imports.entities._legacy_family_common import parse_legacy_person_notes
from app.imports.registry import register
from app.imports import refs

LEGACY_NOTE_CREATED_BY = "legacy-import"


class NotesImporter:
    """Import legacy notes linked to contacts."""

    ENTITY: ClassVar[str] = "notes"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("contacts",)
    PII: ClassVar[bool] = True
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[LegacyNoteRow]:
        return parse_legacy_notes(sql_text)

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        del dry_run
        return ImporterContext()

    def _row_detail(
        self,
        n: LegacyNoteRow,
        *,
        note_id: UUID | None,
        contact_ids: list[UUID],
        dry_run: bool,
    ) -> dict[str, Any]:
        tables: list[dict[str, Any]] = [
            {
                "table": "notes",
                "columns": ["content", "took_at", "created_by", "created_at", "updated_at"],
                "values": {
                    "content": preview_line(self, n.content),
                    "took_at": n.took_at.isoformat(),
                    "created_by": LEGACY_NOTE_CREATED_BY,
                    "created_at": "now()",
                    "updated_at": "now()",
                },
            },
        ]
        nid_disp = str(note_id) if note_id else "…"
        for cid in contact_ids:
            tables.append(
                {
                    "table": "note_entity_links",
                    "columns": ["note_id", "entity_type", "entity_id"],
                    "values": {
                        "note_id": nid_disp,
                        "entity_type": NOTE_ENTITY_TYPE_CONTACT,
                        "entity_id": str(cid),
                    },
                },
            )
        tables.append(
            {
                "table": "legacy_import_refs",
                "columns": ["entity", "legacy_key", "new_id"],
                "values": {
                    "entity": self.ENTITY,
                    "legacy_key": str(n.legacy_id),
                    "new_id": None if dry_run or note_id is None else str(note_id),
                },
            },
        )
        return {
            "legacy_source": {"table": "note", "primary_key": {"id": n.legacy_id}},
            "target": {"tables": tables},
            "dry_run": dry_run,
        }

    def apply(
        self,
        session: Session,
        rows: Sequence[Any],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        stats = ImportStats(entity=self.ENTITY, dry_run=dry_run)
        contact_refs = ctx.refs_by_entity.get("contacts", {})
        if ctx.source_sql_text is None:
            person_map: dict[int, list[int]] = {}
        else:
            person_map = note_id_to_person_ids(
                parse_legacy_person_notes(ctx.source_sql_text),
            )

        for n in rows:
            if not isinstance(n, LegacyNoteRow):
                continue
            if str(n.legacy_id) in ctx.skip_legacy_keys:
                stats.skipped_excluded_key += 1
                continue
            if str(n.legacy_id) in ctx.existing_import_keys:
                stats.skipped_duplicate += 1
                continue

            pids = person_map.get(n.legacy_id, [])
            resolved: list[UUID] = []
            for pid in pids:
                cu = contact_refs.get(str(pid))
                if cu is not None:
                    resolved.append(cu)
            if not resolved:
                stats.skipped_no_dep += 1
                continue

            if dry_run:
                if len(stats.preview) < self.PREVIEW_MAX_ROWS:
                    stats.preview.append(self.format_preview(n, None))
                if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                    stats.row_details.append(
                        self._row_detail(
                            n,
                            note_id=None,
                            contact_ids=resolved,
                            dry_run=True,
                        ),
                    )
                stats.inserted += 1
                continue

            note = Note(
                content=n.content,
                took_at=n.took_at,
                created_by=LEGACY_NOTE_CREATED_BY,
            )
            session.add(note)
            session.flush()
            nid = note.id
            note_uuid = nid if isinstance(nid, UUID) else UUID(str(nid))
            for cid in resolved:
                session.add(
                    NoteEntityLink(
                        note_id=note_uuid,
                        entity_type=NOTE_ENTITY_TYPE_CONTACT,
                        entity_id=cid,
                    ),
                )
            refs.record_mapping(session, self.ENTITY, str(n.legacy_id), note_uuid)
            if len(stats.row_details) < self.PREVIEW_MAX_ROWS:
                stats.row_details.append(
                    self._row_detail(
                        n,
                        note_id=note_uuid,
                        contact_ids=resolved,
                        dry_run=False,
                    ),
                )
            stats.inserted += 1

        if not dry_run:
            session.commit()

        return stats

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        if not isinstance(row, LegacyNoteRow):
            return ""
        return (
            "Would insert: "
            f"note_id={row.legacy_id} | "
            f"content={preview_line(self, row.content[:80])!r}"
        )


def apply_notes(
    session: Session,
    note_rows: Sequence[LegacyNoteRow],
    *,
    dry_run: bool,
    sql_text: str,
    skip_legacy_keys: frozenset[str] | None = None,
) -> ImportStats:
    importer = NotesImporter()
    base = importer.resolve_context(session, dry_run=dry_run)
    sk = skip_legacy_keys or frozenset()
    from app.imports import refs as refs_mod

    existing = refs_mod.load_legacy_keys(session, importer.ENTITY)
    ctx = replace(
        base,
        skip_legacy_keys=base.skip_legacy_keys | sk,
        source_sql_text=sql_text,
        refs_by_entity={"contacts": {}},
        existing_import_keys=base.existing_import_keys | existing,
    )
    return importer.apply(session, note_rows, ctx, dry_run=dry_run)


register(NotesImporter())
