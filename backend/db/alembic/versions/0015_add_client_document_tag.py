"""Ensure client_document system tag exists for admin asset client_tag.

Revision ID: 0015_add_client_document_tag
Revises: 0014_add_asset_tags
"""

from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "0015_add_client_document_tag"
down_revision: Union[str, None] = "0014_add_asset_tags"
branch_labels: Union[str, tuple[str, ...], None] = None
depends_on: Union[str, tuple[str, ...], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO tags (id, name, created_by)
        SELECT gen_random_uuid(), 'client_document', 'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM tags WHERE lower(name) = lower('client_document')
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM asset_tags
        WHERE tag_id IN (
            SELECT id FROM tags WHERE lower(name) = lower('client_document')
        )
        """
    )
    op.execute(
        """
        DELETE FROM tags
        WHERE lower(name) = lower('client_document')
          AND NOT EXISTS (SELECT 1 FROM contact_tags WHERE tag_id = tags.id)
          AND NOT EXISTS (SELECT 1 FROM family_tags WHERE tag_id = tags.id)
          AND NOT EXISTS (SELECT 1 FROM organization_tags WHERE tag_id = tags.id)
          AND NOT EXISTS (SELECT 1 FROM service_tags WHERE tag_id = tags.id)
        """
    )
