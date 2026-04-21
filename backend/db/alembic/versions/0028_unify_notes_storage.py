"""Merge polymorphic ``notes``/``note_entity_links`` into ``crm_notes``, rename to ``notes``.

Backfills contact-linked polymorphic rows into ``crm_notes`` (before rename), drops the
old polymorphic tables, then renames ``crm_notes`` → ``notes`` with explicit index,
constraint, FK, and trigger names.

**Downgrade:** Recreates empty polymorphic ``notes`` + ``note_entity_links`` and reverses
the table rename. Data that lived only in the dropped polymorphic tables is not restored;
rows already in the unified table remain. ``took_at`` is dropped on downgrade.

Seed-data assessment:
1. Compatibility with existing seed SQL: yes — seed does not reference these tables.
2. New NOT NULL: ``took_at`` is nullable; no seed inserts required.
3. Renamed/dropped: no seed references to update.
4. New tables: none (merge + rename).
5. Enum: none.
6. FK order: unchanged.

Result: No seed update — seed file does not reference ``crm_notes``, polymorphic
``notes``, or ``note_entity_links``.
"""

from __future__ import annotations

import logging
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "0028_unify_notes_storage"
down_revision: Union[str, None] = "0027_notes_polymorphic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_LOG = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    bind = op.get_bind()
    orphan_ct = bind.execute(
        text(
            """
            SELECT COUNT(*) FROM note_entity_links l
            WHERE l.entity_type = 'contact'
              AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = l.entity_id)
            """
        )
    ).scalar()
    if orphan_ct and int(orphan_ct) > 0:
        _LOG.warning(
            "unify_notes_storage: dropping %s polymorphic contact links "
            "with no matching contact row",
            int(orphan_ct),
        )

    op.add_column(
        "crm_notes",
        sa.Column("took_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.execute(
        """
        INSERT INTO crm_notes (
            id, contact_id, lead_id, content, created_by,
            created_at, updated_at, took_at
        )
        SELECT
            gen_random_uuid(),
            l.entity_id,
            NULL,
            n.content,
            n.created_by,
            n.created_at,
            n.updated_at,
            n.took_at
        FROM note_entity_links l
        JOIN notes n ON n.id = l.note_id
        JOIN contacts c ON c.id = l.entity_id
        WHERE l.entity_type = 'contact'
        """
    )

    op.execute("DROP TRIGGER IF EXISTS notes_set_updated_at ON notes")
    op.drop_index("note_entity_links_parent_idx", table_name="note_entity_links")
    op.drop_table("note_entity_links")
    op.drop_table("notes")

    op.rename_table("crm_notes", "notes")

    op.execute("ALTER INDEX crm_notes_pkey RENAME TO notes_pkey")

    op.execute("ALTER INDEX crm_notes_contact_idx RENAME TO notes_contact_idx")
    op.execute("ALTER INDEX crm_notes_family_idx RENAME TO notes_family_idx")
    op.execute("ALTER INDEX crm_notes_lead_idx RENAME TO notes_lead_idx")

    op.execute(
        "ALTER TABLE notes RENAME CONSTRAINT crm_notes_has_parent TO notes_has_parent"
    )

    for old_name, new_name in (
        ("crm_notes_contact_id_fkey", "notes_contact_id_fkey"),
        ("crm_notes_family_id_fkey", "notes_family_id_fkey"),
        ("crm_notes_organization_id_fkey", "notes_organization_id_fkey"),
        ("crm_notes_lead_id_fkey", "notes_lead_id_fkey"),
    ):
        op.execute(
            f'ALTER TABLE notes RENAME CONSTRAINT "{old_name}" TO "{new_name}"'
        )

    op.execute(
        """
        ALTER TRIGGER crm_notes_set_updated_at ON notes
        RENAME TO notes_set_updated_at
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS notes_set_updated_at ON notes")

    for new_name, old_name in (
        ("notes_contact_id_fkey", "crm_notes_contact_id_fkey"),
        ("notes_family_id_fkey", "crm_notes_family_id_fkey"),
        ("notes_organization_id_fkey", "crm_notes_organization_id_fkey"),
        ("notes_lead_id_fkey", "crm_notes_lead_id_fkey"),
    ):
        op.execute(
            f'ALTER TABLE notes RENAME CONSTRAINT "{new_name}" TO "{old_name}"'
        )

    op.execute(
        "ALTER TABLE notes RENAME CONSTRAINT notes_has_parent TO crm_notes_has_parent"
    )

    op.execute("ALTER INDEX notes_lead_idx RENAME TO crm_notes_lead_idx")
    op.execute("ALTER INDEX notes_family_idx RENAME TO crm_notes_family_idx")
    op.execute("ALTER INDEX notes_contact_idx RENAME TO crm_notes_contact_idx")

    op.execute("ALTER INDEX notes_pkey RENAME TO crm_notes_pkey")

    op.rename_table("notes", "crm_notes")

    op.execute(
        """
        CREATE TRIGGER crm_notes_set_updated_at
        BEFORE UPDATE ON crm_notes
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.drop_column("crm_notes", "took_at")

    op.create_table(
        "notes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("took_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_table(
        "note_entity_links",
        sa.Column(
            "note_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("note_id", "entity_type", "entity_id"),
        sa.CheckConstraint(
            "entity_type IN ('contact')",
            name="note_entity_links_entity_type_allowed",
        ),
    )
    op.create_index(
        "note_entity_links_parent_idx",
        "note_entity_links",
        ["entity_type", "entity_id"],
    )
    op.execute(
        """
        CREATE TRIGGER notes_set_updated_at
        BEFORE UPDATE ON notes
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )
