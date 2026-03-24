"""Remove expenses with no vendor and their orphan attachment assets.

Deletes operational rows where both managed vendor (`vendor_id`) and display
vendor label (`vendor_name`) are absent: `vendor_id` IS NULL and
`vendor_name` is NULL or blank after trim.

For each such expense, linked `expense_attachments` rows are removed (via
cascade on expense delete). Attachment `assets` are deleted only when no
other table still references them (`expense_attachments`, `asset_access_grants`,
`asset_share_links`, `service_assets`, `sales_leads`).

Amendment links (`amends_expense_id`) pointing at deleted expenses are nulled
first so FK chains do not block deletion.

Seed-data assessment:
1. Seed SQL does not insert expense rows; no conflict.
2. No new NOT NULL/CHECK columns.
3. No renames/drops.
4. No new tables.
5. No enum changes.
6. No seed insert-order impact.

Result: No seed updates required.

Downgrade: Irreversible data deletion; downgrade is a no-op.
"""

from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "0016_del_exp_no_vendor"
down_revision: Union[str, None] = "0015_add_client_document_tag"
branch_labels: Union[str, tuple[str, ...], None] = None
depends_on: Union[str, tuple[str, ...], None] = None


def upgrade() -> None:
    """Delete expenses without vendor and unreferenced attachment assets."""
    op.execute(
        """
        UPDATE expenses e
        SET amends_expense_id = NULL
        FROM expenses tgt
        WHERE e.amends_expense_id = tgt.id
          AND tgt.vendor_id IS NULL
          AND (tgt.vendor_name IS NULL OR trim(tgt.vendor_name) = '')
        """
    )

    op.execute(
        """
        CREATE TEMP TABLE IF NOT EXISTS _tmp_expense_attachment_asset_ids (
            id UUID PRIMARY KEY
        ) ON COMMIT DROP
        """
    )
    op.execute("TRUNCATE _tmp_expense_attachment_asset_ids")

    op.execute(
        """
        INSERT INTO _tmp_expense_attachment_asset_ids (id)
        SELECT DISTINCT ea.asset_id
        FROM expense_attachments ea
        WHERE ea.expense_id IN (
            SELECT e.id
            FROM expenses e
            WHERE e.vendor_id IS NULL
              AND (e.vendor_name IS NULL OR trim(e.vendor_name) = '')
        )
        ON CONFLICT (id) DO NOTHING
        """
    )

    op.execute(
        """
        DELETE FROM expenses e
        WHERE e.vendor_id IS NULL
          AND (e.vendor_name IS NULL OR trim(e.vendor_name) = '')
        """
    )

    op.execute(
        """
        DELETE FROM assets a
        WHERE a.id IN (SELECT t.id FROM _tmp_expense_attachment_asset_ids t)
          AND NOT EXISTS (
              SELECT 1 FROM expense_attachments ea WHERE ea.asset_id = a.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM asset_access_grants g WHERE g.asset_id = a.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM asset_share_links sl WHERE sl.asset_id = a.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM service_assets sa WHERE sa.asset_id = a.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM sales_leads sl WHERE sl.asset_id = a.id
          )
        """
    )


def downgrade() -> None:
    """Data migration; deleted rows cannot be restored."""
