"""Add expense invoice tables and enums.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into new expense tables.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - Constraints only affect new tables and do not impact existing seed rows.
3. Renamed/dropped columns reflected in seed data:
   - No existing columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - `expenses` and `expense_attachments` are operational records created by admins.
5. Enum/allowed-value changes validated in seed rows:
   - New enums are additive and used only by new tables.
6. FK/cascade changes validated for insert order and references:
   - New FKs target existing `assets` and self-reference `expenses` safely.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011_add_expenses"
down_revision: Union[str, None] = "0010_add_services"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _expense_enums() -> dict[str, postgresql.ENUM]:
    return {
        "expense_status": postgresql.ENUM(
            "draft",
            "submitted",
            "paid",
            "voided",
            "amended",
            name="expense_status",
            create_type=False,
        ),
        "expense_parse_status": postgresql.ENUM(
            "not_requested",
            "queued",
            "processing",
            "succeeded",
            "failed",
            name="expense_parse_status",
            create_type=False,
        ),
    }


def upgrade() -> None:
    """Create expense schema objects."""
    bind = op.get_bind()
    enums = _expense_enums()
    for enum_obj in enums.values():
        enum_obj.create(bind, checkfirst=True)

    op.create_table(
        "expenses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "amends_expense_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("expenses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            enums["expense_status"],
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column(
            "parse_status",
            enums["expense_parse_status"],
            nullable=False,
            server_default=sa.text("'not_requested'"),
        ),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("invoice_number", sa.String(128), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=True),
        sa.Column("tax", sa.Numeric(12, 2), nullable=True),
        sa.Column("total", sa.Numeric(12, 2), nullable=True),
        sa.Column("line_items", postgresql.JSONB(), nullable=True),
        sa.Column("parse_confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("parser_raw", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("void_reason", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("voided_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("updated_by", sa.String(128), nullable=True),
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
        sa.CheckConstraint(
            "amends_expense_id IS NULL OR amends_expense_id <> id",
            name="expenses_amendment_not_self",
        ),
        sa.CheckConstraint(
            "parse_confidence IS NULL OR (parse_confidence >= 0 AND parse_confidence <= 1)",
            name="expenses_parse_confidence_range",
        ),
    )
    op.create_index("expenses_status_idx", "expenses", ["status"])
    op.create_index("expenses_parse_status_idx", "expenses", ["parse_status"])
    op.create_index("expenses_invoice_date_idx", "expenses", ["invoice_date"])
    op.create_index("expenses_amends_expense_idx", "expenses", ["amends_expense_id"])
    op.execute(
        """
        CREATE TRIGGER expenses_set_updated_at
        BEFORE UPDATE ON expenses
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "expense_attachments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "expense_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("expenses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "expense_attachments_expense_idx", "expense_attachments", ["expense_id"]
    )
    op.create_index(
        "expense_attachments_asset_idx", "expense_attachments", ["asset_id"]
    )
    op.create_index(
        "expense_attachments_unique_idx",
        "expense_attachments",
        ["expense_id", "asset_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop expense schema objects."""
    op.drop_index("expense_attachments_unique_idx", table_name="expense_attachments")
    op.drop_index("expense_attachments_asset_idx", table_name="expense_attachments")
    op.drop_index("expense_attachments_expense_idx", table_name="expense_attachments")
    op.drop_table("expense_attachments")

    op.execute("DROP TRIGGER IF EXISTS expenses_set_updated_at ON expenses")
    op.drop_index("expenses_amends_expense_idx", table_name="expenses")
    op.drop_index("expenses_invoice_date_idx", table_name="expenses")
    op.drop_index("expenses_parse_status_idx", table_name="expenses")
    op.drop_index("expenses_status_idx", table_name="expenses")
    op.drop_table("expenses")

    bind = op.get_bind()
    enums = _expense_enums()
    for enum_obj in enums.values():
        enum_obj.drop(bind, checkfirst=True)
