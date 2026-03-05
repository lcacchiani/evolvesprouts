"""Expand CRM enum values for contact_source.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert rows into `contacts`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - No columns are added.
3. Renamed/dropped columns reflected in seed data:
   - No columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - No tables are added.
5. Enum/allowed-value changes validated in seed rows:
   - This migration is additive-only for `contact_source`.
6. FK/cascade changes validated for insert order and references:
   - No FK or cascade changes are introduced.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0009_expand_crm_enums"
down_revision: Union[str, None] = "0008_add_asset_resource_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new CRM source enum values."""
    op.execute("ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'whatsapp'")
    op.execute("ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'linkedin'")
    op.execute("ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'event'")
    op.execute("ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'phone_call'")
    op.execute("ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'public_website'")


def downgrade() -> None:
    """PostgreSQL enum value removals are intentionally not attempted."""
    return None
