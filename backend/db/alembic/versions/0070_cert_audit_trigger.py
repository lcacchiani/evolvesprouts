"""Attach audit trigger to completion_certificates.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: trigger only; no schema/data change.
2. N/A.
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id: ``0070_cert_audit_trigger`` (24 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0070_cert_audit_trigger"
down_revision: Union[str, None] = "0069_completion_certs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TRIGGER completion_certificates_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON completion_certificates
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS completion_certificates_audit_trigger ON completion_certificates;"
    )
