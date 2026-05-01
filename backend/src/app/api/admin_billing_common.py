"""Shared session + audit context for admin billing handlers."""

from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy.orm import Session

from app.db.audit import set_audit_context
from app.db.engine import get_engine

DEFAULT_BILLING_LIST_LIMIT = 50


@contextmanager
def _session_with_audit(user_sub: str, request_id_val: str | None):
    """Open a session + transaction and set audit context inside the transaction."""
    with Session(get_engine()) as session:
        with session.begin():
            set_audit_context(session, user_id=user_sub, request_id=request_id_val)
            yield session
