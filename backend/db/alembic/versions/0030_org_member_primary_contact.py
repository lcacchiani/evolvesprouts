"""Add is_primary_contact to organization_members.

Seed-data assessment:
1. Compatibility with existing seed SQL: seed does not insert `organization_members` rows.
2. New NOT NULL: `is_primary_contact` defaults to false for existing rows.
3. Renamed/dropped: N/A (additive).
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

Result: No seed update — `backend/db/seed/seed_data.sql` does not reference
`organization_members`.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_org_member_primary_contact"
down_revision: Union[str, None] = "0029_organizations_partner_slug"
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


def downgrade() -> None:
    op.drop_column("organization_members", "is_primary_contact")
