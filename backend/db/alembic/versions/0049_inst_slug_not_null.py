"""Set ``service_instances.slug`` NOT NULL.

Pre-upgrade guard ensures no NULL/empty slugs remain (0048 should have filled them).

Seed-data assessment: unchanged; seed does not insert service_instances.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0049_inst_slug_not_null"
down_revision: Union[str, None] = "0048_inst_slug_backfill_consult"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM service_instances
                WHERE slug IS NULL OR trim(coalesce(slug, '')) = ''
              ) THEN
                RAISE EXCEPTION
                  '0049: service_instances.slug must be non-null and non-empty before NOT NULL';
              END IF;
            END $$;
            """
        )
    )
    op.alter_column(
        "service_instances",
        "slug",
        existing_type=sa.String(length=128),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "service_instances",
        "slug",
        existing_type=sa.String(length=128),
        nullable=True,
    )
