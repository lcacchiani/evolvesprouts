"""Add Eventbrite sync tracking fields to service instances.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into `service_instances`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - `eventbrite_sync_status` is NOT NULL with server default `'pending'`.
   - `eventbrite_retry_count` is NOT NULL with server default `0`.
3. Renamed/dropped columns reflected in seed data:
   - No renamed or dropped columns.
4. New tables evaluated for seed rows:
   - No new tables in this migration.
5. Enum/allowed-value changes validated in seed rows:
   - New enum is additive and does not affect existing seed rows.
6. FK/cascade changes validated for insert order and references:
   - No new foreign keys in this migration.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0019_eventbrite_sync"
down_revision: Union[str, None] = "0018_geo_area_sovereign_country"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create Eventbrite sync enum and instance tracking columns."""
    bind = op.get_bind()
    eventbrite_sync_status = postgresql.ENUM(
        "pending",
        "syncing",
        "synced",
        "failed",
        name="eventbrite_sync_status",
        create_type=False,
    )
    eventbrite_sync_status.create(bind, checkfirst=True)

    op.add_column(
        "service_instances",
        sa.Column("eventbrite_event_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column("eventbrite_event_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column(
            "eventbrite_sync_status",
            eventbrite_sync_status,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
    )
    op.add_column(
        "service_instances",
        sa.Column(
            "eventbrite_last_synced_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "service_instances",
        sa.Column("eventbrite_last_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column("eventbrite_last_payload_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column(
            "eventbrite_ticket_class_map",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "service_instances",
        sa.Column(
            "eventbrite_retry_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_index(
        "svc_instances_eventbrite_sync_status_idx",
        "service_instances",
        ["eventbrite_sync_status"],
    )


def downgrade() -> None:
    """Drop Eventbrite sync columns and enum."""
    bind = op.get_bind()
    op.drop_index(
        "svc_instances_eventbrite_sync_status_idx",
        table_name="service_instances",
    )
    op.drop_column("service_instances", "eventbrite_retry_count")
    op.drop_column("service_instances", "eventbrite_ticket_class_map")
    op.drop_column("service_instances", "eventbrite_last_payload_hash")
    op.drop_column("service_instances", "eventbrite_last_error")
    op.drop_column("service_instances", "eventbrite_last_synced_at")
    op.drop_column("service_instances", "eventbrite_sync_status")
    op.drop_column("service_instances", "eventbrite_event_url")
    op.drop_column("service_instances", "eventbrite_event_id")

    eventbrite_sync_status = postgresql.ENUM(
        "pending",
        "syncing",
        "synced",
        "failed",
        name="eventbrite_sync_status",
        create_type=False,
    )
    eventbrite_sync_status.drop(bind, checkfirst=True)
