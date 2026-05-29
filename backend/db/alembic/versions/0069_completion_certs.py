"""Add ``completion_certificates`` for training completion PDFs.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: new table only.
2. N/A.
3. N/A.
4. N/A (no seed rows required).
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id: ``0069_completion_certs`` (22 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0069_completion_certs"
down_revision: Union[str, None] = "0068_inst_capacity_left_override"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_completion_status = postgresql.ENUM(
    "issued",
    "voided",
    name="completion_certificate_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    _completion_status.create(bind, checkfirst=True)
    op.create_table(
        "completion_certificates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enrollment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "partner_organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("participation_date", sa.Date(), nullable=False),
        sa.Column("recipient_display_name", sa.Text(), nullable=False),
        sa.Column("program_title", sa.Text(), nullable=False),
        sa.Column("partner_display_name", sa.Text(), nullable=True),
        sa.Column("partner_signer_name", sa.Text(), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=False),
        sa.Column(
            "status",
            _completion_status,
            nullable=False,
            server_default="issued",
        ),
        sa.Column("issued_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("issued_by", sa.Text(), nullable=False),
        sa.Column("voided_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("voided_by", sa.Text(), nullable=True),
        sa.Column("issued_pdf_s3_key", sa.Text(), nullable=True),
        sa.Column("issued_pdf_sha256", sa.String(length=64), nullable=True),
        sa.Column("pdf_template_version", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["instance_id"], ["service_instances.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["enrollment_id"], ["enrollments.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["partner_organization_id"],
            ["organizations.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "completion_certificates_contact_idx",
        "completion_certificates",
        ["contact_id"],
    )
    op.create_index(
        "completion_certificates_instance_idx",
        "completion_certificates",
        ["instance_id"],
    )
    op.create_index(
        "completion_certificates_issued_at_idx",
        "completion_certificates",
        ["issued_at"],
    )


def downgrade() -> None:
    op.drop_index("completion_certificates_issued_at_idx", "completion_certificates")
    op.drop_index("completion_certificates_instance_idx", "completion_certificates")
    op.drop_index("completion_certificates_contact_idx", "completion_certificates")
    op.drop_table("completion_certificates")
    bind = op.get_bind()
    _completion_status.drop(bind, checkfirst=True)
