"""Per-booking service instances for consultations and intro calls.

Templates (consultation / intro_call tiers with no parent) gain ``is_template`` and
optional ``parent_instance_id`` on booking-only rows. Session slots gain
``template_instance_id`` so concurrent bookings race on
``(template_instance_id, starts_at)`` instead of a shared instance row.
Legacy template-tier slot rows are self-tagged with ``template_instance_id = instance_id``
so the new partial unique applies to intro-call tier slots.

Seed compatibility: ``backend/db/seed/seed_data.sql`` needs no row edits; the
backfill sets ``is_template = TRUE`` for existing consultation and intro_call tier
instances (including ``intro-call-free-15min``).

Revision id length: 28 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0061_per_booking_instances"
down_revision: Union[str, None] = "0060_intro_call_starts_uniq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "service_instances",
        sa.Column("parent_instance_id", PG_UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column(
            "is_template",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE service_instances AS si
            SET is_template = TRUE
            FROM services AS s
            WHERE si.service_id = s.id
              AND si.parent_instance_id IS NULL
              AND s.service_type IN ('consultation', 'intro_call')
            """
        )
    )

    op.create_foreign_key(
        "service_instances_parent_instance_id_fkey",
        "service_instances",
        "service_instances",
        ["parent_instance_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "svc_instances_parent_idx",
        "service_instances",
        ["parent_instance_id"],
    )
    op.create_check_constraint(
        "service_instances_template_consistency_chk",
        "service_instances",
        "(is_template IS TRUE AND parent_instance_id IS NULL) "
        "OR (is_template IS FALSE)",
    )

    op.drop_index("svc_instances_slug_uq", table_name="service_instances")
    op.execute(
        """
        CREATE UNIQUE INDEX svc_instances_slug_uq_template
        ON service_instances (slug)
        WHERE is_template IS TRUE
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX svc_instances_slug_uq_booking
        ON service_instances (slug)
        WHERE is_template IS FALSE
        """
    )

    op.drop_index(
        "instance_session_slots_instance_starts_uidx",
        table_name="instance_session_slots",
    )

    op.add_column(
        "instance_session_slots",
        sa.Column("template_instance_id", PG_UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE instance_session_slots AS iss
            SET template_instance_id = COALESCE(
                si.parent_instance_id,
                CASE WHEN si.is_template THEN si.id END
            )
            FROM service_instances AS si
            WHERE iss.instance_id = si.id
            """
        )
    )
    op.create_foreign_key(
        "instance_session_slots_template_instance_id_fkey",
        "instance_session_slots",
        "service_instances",
        ["template_instance_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        CREATE UNIQUE INDEX instance_session_slots_template_starts_uidx
        ON instance_session_slots (template_instance_id, starts_at)
        WHERE template_instance_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS instance_session_slots_template_starts_uidx")
    op.drop_constraint(
        "instance_session_slots_template_instance_id_fkey",
        "instance_session_slots",
        type_="foreignkey",
    )
    op.drop_column("instance_session_slots", "template_instance_id")

    op.create_index(
        "instance_session_slots_instance_starts_uidx",
        "instance_session_slots",
        ["instance_id", "starts_at"],
        unique=True,
    )

    op.execute("DROP INDEX IF EXISTS svc_instances_slug_uq_booking")
    op.execute("DROP INDEX IF EXISTS svc_instances_slug_uq_template")
    op.create_index(
        "svc_instances_slug_uq",
        "service_instances",
        ["slug"],
        unique=True,
    )

    op.drop_index("svc_instances_parent_idx", table_name="service_instances")
    op.drop_constraint(
        "service_instances_parent_instance_id_fkey",
        "service_instances",
        type_="foreignkey",
    )
    op.drop_constraint(
        "service_instances_template_consistency_chk",
        "service_instances",
        type_="check",
    )
    op.drop_column("service_instances", "is_template")
    op.drop_column("service_instances", "parent_instance_id")
