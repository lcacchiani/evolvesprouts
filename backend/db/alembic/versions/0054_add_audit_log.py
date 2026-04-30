"""Create ``audit_log`` table and triggers on asset tables.

Recreates the storage and trigger-based auditing removed when the migration
baseline was reset (legacy ``0010_add_audit_logging``). Triggers apply only to
tables that exist in the current schema: ``assets`` and ``asset_access_grants``.

Seed-data assessment:
1. Seed compatibility: new table; seed does not insert into ``audit_log``.
2. NOT NULL: only on columns with defaults or required fields; no seed impact.
3. N/A.
4. No seed rows for ``audit_log`` (append-only operational data).
5. N/A.
6. N/A.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0054_add_audit_log"
down_revision: Union[str, None] = "0053_manual_block_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AUDITED_TABLES: tuple[str, ...] = ("assets", "asset_access_grants")


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "timestamp",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("table_name", sa.Text(), nullable=False),
        sa.Column("record_id", sa.Text(), nullable=False),
        sa.Column(
            "action",
            sa.Text(),
            nullable=False,
            comment="INSERT, UPDATE, or DELETE",
        ),
        sa.Column(
            "user_id",
            sa.Text(),
            nullable=True,
            comment="Cognito user sub who made the change",
        ),
        sa.Column(
            "request_id",
            sa.Text(),
            nullable=True,
            comment="Lambda request ID for correlation",
        ),
        sa.Column(
            "old_values",
            postgresql.JSONB(),
            nullable=True,
            comment="Previous values (for UPDATE/DELETE)",
        ),
        sa.Column(
            "new_values",
            postgresql.JSONB(),
            nullable=True,
            comment="New values (for INSERT/UPDATE)",
        ),
        sa.Column(
            "changed_fields",
            postgresql.ARRAY(sa.Text()),
            nullable=True,
            comment="List of fields that changed (for UPDATE)",
        ),
        sa.Column(
            "source",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'trigger'"),
            comment="Source of the audit entry: trigger or application",
        ),
        sa.Column(
            "ip_address",
            sa.Text(),
            nullable=True,
            comment="Client IP address if available",
        ),
        sa.Column(
            "user_agent",
            sa.Text(),
            nullable=True,
            comment="Client user agent if available",
        ),
    )
    op.create_index(
        "audit_log_table_record_idx",
        "audit_log",
        ["table_name", "record_id"],
    )
    op.create_index(
        "audit_log_timestamp_idx",
        "audit_log",
        ["timestamp"],
    )
    op.create_index(
        "audit_log_user_id_idx",
        "audit_log",
        ["user_id"],
    )
    op.create_index(
        "audit_log_action_idx",
        "audit_log",
        ["action"],
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION audit_trigger_func()
        RETURNS TRIGGER AS $$
        DECLARE
            record_id_val TEXT;
            old_data JSONB;
            new_data JSONB;
            changed_cols TEXT[];
            col_name TEXT;
            current_user_id TEXT;
            current_request_id TEXT;
        BEGIN
            current_user_id := current_setting('app.current_user_id', true);
            current_request_id := current_setting('app.current_request_id', true);

            IF TG_OP = 'DELETE' THEN
                record_id_val := OLD.id::text;
            ELSE
                record_id_val := NEW.id::text;
            END IF;

            IF TG_OP IN ('UPDATE', 'DELETE') THEN
                old_data := to_jsonb(OLD);
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                new_data := to_jsonb(NEW);
            END IF;

            IF TG_OP = 'UPDATE' THEN
                changed_cols := ARRAY[]::TEXT[];
                FOR col_name IN
                    SELECT key FROM jsonb_object_keys(new_data) AS key
                LOOP
                    IF (old_data->col_name) IS DISTINCT FROM (new_data->col_name) THEN
                        changed_cols := array_append(changed_cols, col_name);
                    END IF;
                END LOOP;

                IF array_length(changed_cols, 1) IS NULL THEN
                    RETURN NEW;
                END IF;
            END IF;

            INSERT INTO audit_log (
                table_name,
                record_id,
                action,
                user_id,
                request_id,
                old_values,
                new_values,
                changed_fields,
                source
            ) VALUES (
                TG_TABLE_NAME,
                record_id_val,
                TG_OP,
                NULLIF(current_user_id, ''),
                NULLIF(current_request_id, ''),
                old_data,
                new_data,
                changed_cols,
                'trigger'
            );

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table_name in AUDITED_TABLES:
        op.execute(f"""
            CREATE TRIGGER {table_name}_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON {table_name}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
        """)


def downgrade() -> None:
    for table_name in AUDITED_TABLES:
        op.execute(
            f"DROP TRIGGER IF EXISTS {table_name}_audit_trigger ON {table_name};"
        )

    op.execute("DROP FUNCTION IF EXISTS audit_trigger_func();")

    op.drop_index("audit_log_action_idx", table_name="audit_log")
    op.drop_index("audit_log_user_id_idx", table_name="audit_log")
    op.drop_index("audit_log_timestamp_idx", table_name="audit_log")
    op.drop_index("audit_log_table_record_idx", table_name="audit_log")
    op.drop_table("audit_log")
