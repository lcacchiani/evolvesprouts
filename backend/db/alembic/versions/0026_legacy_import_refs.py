"""Add legacy_import_refs for CRM legacy import idempotency.

Seed-data assessment:
1. Compatibility with existing seed SQL: yes — new table, not referenced.
2. New NOT NULL/CHECK: N/A — table populated only by import Lambda.
3. Renamed/dropped columns: N/A.
4. New tables seeded: no — left empty by design; seed file unchanged.
5. Enum/allowed-value: N/A.
6. FK/cascade: none.

Result: No seed update — legacy_import_refs is populated only by the import Lambda.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026_legacy_import_refs"
down_revision: Union[str, None] = "0025_discount_codes_value_check"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legacy_import_refs",
        sa.Column("entity", sa.Text(), nullable=False),
        sa.Column("legacy_key", sa.Text(), nullable=False),
        sa.Column("new_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "imported_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("entity", "legacy_key"),
    )
    op.create_index(
        "legacy_import_refs_new_id_idx",
        "legacy_import_refs",
        ["new_id"],
    )


def downgrade() -> None:
    op.drop_index("legacy_import_refs_new_id_idx", table_name="legacy_import_refs")
    op.drop_table("legacy_import_refs")
