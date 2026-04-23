"""Add external_url to service_instances and partner-org M2M table.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed unaffected (no references to new columns/table).
2. NOT NULL: ``external_url`` is nullable; M2M table empty by default.
3. Renamed/dropped: N/A.
4. New tables: ``service_instance_organizations`` starts empty; no seed rows required.
5. Enum: N/A.
6. FK order: table references ``service_instances`` and ``organizations`` (already seeded).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0036_instance_partners_ext_url"
down_revision: Union[str, None] = "0035_event_default_price"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "service_instances",
        sa.Column("external_url", sa.String(length=500), nullable=True),
    )
    op.create_table(
        "service_instance_organizations",
        sa.Column(
            "service_instance_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("service_instance_id", "organization_id"),
    )
    op.create_index(
        "svc_instance_org_instance_idx",
        "service_instance_organizations",
        ["service_instance_id"],
    )
    op.create_index(
        "svc_instance_org_organization_idx",
        "service_instance_organizations",
        ["organization_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "svc_instance_org_organization_idx",
        table_name="service_instance_organizations",
    )
    op.drop_index(
        "svc_instance_org_instance_idx",
        table_name="service_instance_organizations",
    )
    op.drop_table("service_instance_organizations")
    op.drop_column("service_instances", "external_url")
