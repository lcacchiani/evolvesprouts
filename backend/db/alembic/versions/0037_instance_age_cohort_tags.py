"""Add age_group, cohort, and service_instance_tags.

1. Compatibility: seed does not insert into ``service_instances``; new columns nullable.
2. New NOT NULL: none.
3. Renamed/dropped: n/a.
4. New table ``service_instance_tags``: empty at migration time; no seed rows.
5. Enum: n/a.
6. FK: ``service_instance_tags`` references ``service_instances`` and ``tags`` (existing).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0037_instance_age_cohort_tags"
down_revision = "0036_instance_partners_ext_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service_instances",
        sa.Column("age_group", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column("cohort", sa.String(length=128), nullable=True),
    )
    op.create_table(
        "service_instance_tags",
        sa.Column(
            "service_instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("service_instance_id", "tag_id"),
    )
    op.create_index(
        "svc_instance_tags_instance_idx",
        "service_instance_tags",
        ["service_instance_id"],
    )
    op.create_index(
        "svc_instance_tags_tag_idx",
        "service_instance_tags",
        ["tag_id"],
    )


def downgrade() -> None:
    op.drop_index("svc_instance_tags_tag_idx", table_name="service_instance_tags")
    op.drop_index("svc_instance_tags_instance_idx", table_name="service_instance_tags")
    op.drop_table("service_instance_tags")
    op.drop_column("service_instances", "cohort")
    op.drop_column("service_instances", "age_group")
