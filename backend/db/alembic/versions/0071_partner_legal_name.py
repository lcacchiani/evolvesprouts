"""Add ``organizations.legal_name`` for partner invoice bill-to display.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: seed file has no ``organizations`` inserts.
2. Nullable column; no NOT NULL constraint.
3. N/A.
4. No seed rows for organizations.
5. N/A.
6. N/A.

Result: No seed updates required (see seed file note).

Revision id: ``0071_partner_legal_name`` (22 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0071_partner_legal_name"
down_revision: Union[str, None] = "0070_cert_audit_trigger"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("legal_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organizations", "legal_name")
