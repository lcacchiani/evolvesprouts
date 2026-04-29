"""Rename ``services.slug`` to ``services.service_key``; rename composite unique index.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed ``UPDATE services SET slug = ...`` becomes ``service_key``.
2. NOT NULL: unchanged (column stays nullable).
3. Renamed column reflected in seed.
4. New tables: none.
5. Enum: none.
6. FK: none.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0046_services_slug_to_key"
down_revision: Union[str, None] = "0045_enroll_inst_contact_uidx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("services", "slug", new_column_name="service_key")
    op.execute(
        "ALTER INDEX IF EXISTS services_slug_tier_unique_idx "
        "RENAME TO services_service_key_tier_unique_idx"
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX IF EXISTS services_service_key_tier_unique_idx "
        "RENAME TO services_slug_tier_unique_idx"
    )
    op.alter_column("services", "service_key", new_column_name="slug")
