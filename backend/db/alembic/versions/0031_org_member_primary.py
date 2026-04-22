"""Add ``is_primary_contact`` to ``organization_members``.

Seed-data assessment:
1. Compatibility: ``backend/db/seed/seed_data.sql`` does not insert into
   ``organization_members``.
2. NOT NULL: new column uses ``server_default=false`` then enforces NOT NULL.
3. Renamed/dropped: N/A.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

Result: No seed update required.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_org_member_primary"
down_revision: Union[str, None] = "0030_drop_families_org_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organization_members",
        sa.Column(
            "is_primary_contact",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.alter_column(
        "organization_members",
        "is_primary_contact",
        server_default=None,
    )
    op.execute(
        sa.text(
            """
            UPDATE organization_members AS om
            SET role = CASE c.contact_type::text
              WHEN 'parent' THEN 'staff'
              WHEN 'child' THEN 'member'
              WHEN 'helper' THEN 'staff'
              WHEN 'professional' THEN 'staff'
              ELSE 'other'
            END::organization_role
            FROM contacts AS c
            WHERE c.id = om.contact_id
            """
        )
    )


def downgrade() -> None:
    op.drop_column("organization_members", "is_primary_contact")
