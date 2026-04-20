"""Add polymorphic ``notes`` + ``note_entity_links`` (generic legacy notes).

Seed-data assessment:
1. Compatibility with existing seed SQL: yes — new tables, not referenced.
2. New NOT NULL/CHECK: handled in new tables only; seed does not insert.
3. Renamed/dropped columns: none.
4. New tables: ``notes``, ``note_entity_links`` — no seed rows (operator/import only).
5. Enum/allowed-value: text + CHECK on ``entity_type``, not a DB enum.
6. FK/cascade: ``note_entity_links.note_id`` → ``notes.id`` ON DELETE CASCADE only.

Result: No seed update — tables are populated only by legacy import or future admin flows.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027_notes_polymorphic"
down_revision: Union[str, None] = "0026_legacy_import_refs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS notes_set_updated_at ON notes")
    op.drop_index("note_entity_links_parent_idx", table_name="note_entity_links")
    op.drop_table("note_entity_links")
    op.drop_table("notes")
