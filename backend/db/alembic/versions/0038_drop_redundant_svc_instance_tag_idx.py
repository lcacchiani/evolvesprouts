"""Drop redundant index on service_instance_tags(service_instance_id).

The composite primary key already begins with ``service_instance_id``; keep the
``tag_id`` index for reverse lookups.
"""

from __future__ import annotations

from alembic import op

revision = "0038_drop_inst_tag_inst_idx"
down_revision = "0037_instance_age_cohort_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("svc_instance_tags_instance_idx", table_name="service_instance_tags")


def downgrade() -> None:
    op.create_index(
        "svc_instance_tags_instance_idx",
        "service_instance_tags",
        ["service_instance_id"],
    )
