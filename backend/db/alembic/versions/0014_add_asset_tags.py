"""Add asset_tags junction for tagging assets (e.g. expense attachments).

Revision ID: 0014_add_asset_tags
Revises: 0013_add_inbound_email
"""

from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014_add_asset_tags"
down_revision: Union[str, None] = "0013_add_inbound_email"
branch_labels: Union[str, tuple[str, ...], None] = None
depends_on: Union[str, tuple[str, ...], None] = None


def upgrade() -> None:
    op.create_table(
        "asset_tags",
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("asset_tags_tag_idx", "asset_tags", ["tag_id"])

    op.execute(
        """
        INSERT INTO tags (id, name, created_by)
        SELECT gen_random_uuid(), 'expense_attachment', 'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM tags WHERE lower(name) = lower('expense_attachment')
        )
        """
    )

    op.execute(
        """
        INSERT INTO asset_tags (asset_id, tag_id)
        SELECT DISTINCT ea.asset_id, t.id
        FROM expense_attachments ea
        INNER JOIN tags t ON lower(t.name) = lower('expense_attachment')
        ON CONFLICT (asset_id, tag_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("asset_tags_tag_idx", table_name="asset_tags")
    op.drop_table("asset_tags")
