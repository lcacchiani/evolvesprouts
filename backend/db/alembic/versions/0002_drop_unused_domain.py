"""Drop unused organization/activity/feedback domain tables.

Seed-data assessment:
- `backend/db/seed/seed_data.sql` currently contains no rows for the dropped
  tables/columns, so no seed update is required for this migration.
"""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op

revision: str = "0002_drop_unused_domain"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop legacy domain tables and related columns."""
    op.execute(
        """
        ALTER TABLE IF EXISTS assets
        DROP COLUMN IF EXISTS organization_id;
        """
    )
    op.execute(
        """
        DROP INDEX IF EXISTS assets_organization_id_idx;
        """
    )

    op.execute(
        """
        ALTER TABLE IF EXISTS tickets
        DROP COLUMN IF EXISTS organization_id,
        DROP COLUMN IF EXISTS feedback_stars,
        DROP COLUMN IF EXISTS feedback_label_ids,
        DROP COLUMN IF EXISTS feedback_text,
        DROP COLUMN IF EXISTS created_organization_id;
        """
    )

    op.execute(
        """
        ALTER TABLE IF EXISTS locations
        DROP COLUMN IF EXISTS org_id;
        """
    )

    op.execute(
        """
        DROP TABLE IF EXISTS organization_feedback CASCADE;
        DROP TABLE IF EXISTS feedback_labels CASCADE;
        DROP TABLE IF EXISTS activity_schedule_entries CASCADE;
        DROP TABLE IF EXISTS activity_schedule CASCADE;
        DROP TABLE IF EXISTS activity_pricing CASCADE;
        DROP TABLE IF EXISTS activity_locations CASCADE;
        DROP TABLE IF EXISTS activities CASCADE;
        DROP TABLE IF EXISTS activity_categories CASCADE;
        DROP TABLE IF EXISTS organizations CASCADE;
        """
    )

    op.execute(
        """
        DROP TYPE IF EXISTS pricing_type;
        DROP TYPE IF EXISTS schedule_type;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = 'tickets'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'tickets'
                  AND column_name = 'ticket_type'
            ) THEN
                DELETE FROM tickets
                WHERE ticket_type::text = 'organization_feedback';
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'ticket_type'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type
                    WHERE typname = 'ticket_type_new'
                ) THEN
                    CREATE TYPE ticket_type_new AS ENUM (
                        'access_request',
                        'organization_suggestion'
                    );
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'tickets'
                )
                AND EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'tickets'
                      AND column_name = 'ticket_type'
                ) THEN
                    ALTER TABLE tickets
                    ALTER COLUMN ticket_type TYPE ticket_type_new
                    USING ticket_type::text::ticket_type_new;
                END IF;

                DROP TYPE ticket_type;
                ALTER TYPE ticket_type_new RENAME TO ticket_type;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    """Downgrade is not supported for destructive table removal."""
    raise RuntimeError(
        "Downgrade is not supported for 0002_drop_unused_domain."
    )
