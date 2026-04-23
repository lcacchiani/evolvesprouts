"""Add tags.archived_at for soft-retiring CRM labels.

1. New nullable ``tags.archived_at`` (timestamptz): null means active; set when archived.
2. No seed changes: seed does not insert into ``tags`` beyond prior migrations; existing
   rows default to active (null).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0039_tags_archived_at"
down_revision = "0038_drop_inst_tag_inst_idx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tags",
        sa.Column(
            "archived_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("tags", "archived_at")
