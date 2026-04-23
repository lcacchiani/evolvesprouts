"""Add services.service_tier and services.location_id; drop service_instances.age_group.

1. Seed: does not set ``service_instances.age_group``; new service columns nullable.
2. NOT NULL: none added.
3. Dropped column: ``age_group`` removed from instances (no data migration per product decision).
4. New FK: ``services.location_id`` references ``locations.id`` ON DELETE SET NULL.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0041_service_tier_location"
down_revision = "0039_tags_archived_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("service_tier", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "services",
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.drop_column("service_instances", "age_group")


def downgrade() -> None:
    op.add_column(
        "service_instances",
        sa.Column("age_group", sa.String(length=128), nullable=True),
    )
    op.drop_column("services", "location_id")
    op.drop_column("services", "service_tier")
