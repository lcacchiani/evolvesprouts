"""PostgreSQL integration checks for billing audit context.

Skipped unless ``TEST_DATABASE_URL`` is set (same harness as other DB tests).
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.db.audit import set_audit_context

pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


def _database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_set_audit_context_survives_explicit_transaction() -> None:
    """Regression for admin/public billing: GUC must be set inside ``begin()``."""
    url = _database_url()
    assert url is not None
    engine = create_engine(url)
    with Session(engine) as session:
        with session.begin():
            set_audit_context(session, user_id="integration-test-sub", request_id="req-int-1")
            uid = session.execute(
                text("SELECT current_setting('app.current_user_id', true) AS v")
            ).scalar_one()
            rid = session.execute(
                text("SELECT current_setting('app.current_request_id', true) AS v")
            ).scalar_one()
    assert uid == "integration-test-sub"
    assert rid == "req-int-1"
