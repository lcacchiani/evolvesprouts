"""Initial schema for assets and access grants."""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create asset tables, enums, and indexes."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    asset_type_enum = postgresql.ENUM(
        "guide",
        "video",
        "pdf",
        "document",
        name="asset_type",
        create_type=False,
    )
    asset_visibility_enum = postgresql.ENUM(
        "public",
        "restricted",
        name="asset_visibility",
        create_type=False,
    )
    access_grant_type_enum = postgresql.ENUM(
        "all_authenticated",
        "organization",
        "user",
        name="access_grant_type",
        create_type=False,
    )
    asset_type_enum.create(op.get_bind(), checkfirst=True)
    asset_visibility_enum.create(op.get_bind(), checkfirst=True)
    access_grant_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "assets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("asset_type", asset_type_enum, nullable=False),
        sa.Column("s3_key", sa.String(), nullable=False, unique=True),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("content_type", sa.String(127), nullable=True),
        sa.Column("visibility", asset_visibility_enum, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("assets_visibility_idx", "assets", ["visibility"])
    op.create_index("assets_asset_type_idx", "assets", ["asset_type"])
    op.create_index("assets_organization_id_idx", "assets", ["organization_id"])
    op.create_index("assets_created_by_idx", "assets", ["created_by"])

    op.create_table(
        "asset_access_grants",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("grant_type", access_grant_type_enum, nullable=False),
        sa.Column("grantee_id", sa.String(128), nullable=True),
        sa.Column("granted_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("access_grants_asset_idx", "asset_access_grants", ["asset_id"])
    op.create_index("access_grants_grantee_idx", "asset_access_grants", ["grantee_id"])
    op.create_index(
        "access_grants_unique",
        "asset_access_grants",
        ["asset_id", "grant_type", sa.text("COALESCE(grantee_id, '')")],
        unique=True,
    )


def downgrade() -> None:
    """Drop asset tables, enums, and indexes."""
    op.drop_index("access_grants_unique", table_name="asset_access_grants")
    op.drop_index("access_grants_grantee_idx", table_name="asset_access_grants")
    op.drop_index("access_grants_asset_idx", table_name="asset_access_grants")
    op.drop_table("asset_access_grants")

    op.drop_index("assets_created_by_idx", table_name="assets")
    op.drop_index("assets_organization_id_idx", table_name="assets")
    op.drop_index("assets_asset_type_idx", table_name="assets")
    op.drop_index("assets_visibility_idx", table_name="assets")
    op.drop_table("assets")

    access_grant_type_enum = postgresql.ENUM(
        "all_authenticated",
        "organization",
        "user",
        name="access_grant_type",
        create_type=False,
    )
    asset_visibility_enum = postgresql.ENUM(
        "public",
        "restricted",
        name="asset_visibility",
        create_type=False,
    )
    asset_type_enum = postgresql.ENUM(
        "guide",
        "video",
        "pdf",
        "document",
        name="asset_type",
        create_type=False,
    )
    access_grant_type_enum.drop(op.get_bind(), checkfirst=True)
    asset_visibility_enum.drop(op.get_bind(), checkfirst=True)
    asset_type_enum.drop(op.get_bind(), checkfirst=True)
