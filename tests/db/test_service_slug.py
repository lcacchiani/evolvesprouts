"""Unit tests for service slug resolution (no live database required)."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from app.db.models import Service
from app.db.repositories.service import ServiceRepository


def test_get_by_slug_queries_lowered_slug() -> None:
    svc_id = uuid4()
    mock_row = MagicMock(spec=Service)
    mock_row.id = svc_id

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar_one_or_none.return_value = mock_row

    repo = ServiceRepository(mock_session)
    found = repo.get_by_slug("My-Best-Auntie")

    assert found is mock_row
    mock_session.execute.assert_called_once()
    stmt = mock_session.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
    assert "lower" in compiled.lower()


def test_get_by_slug_blank_returns_none() -> None:
    mock_session = MagicMock()
    repo = ServiceRepository(mock_session)
    assert repo.get_by_slug("") is None
    assert repo.get_by_slug("   ") is None
    mock_session.execute.assert_not_called()
