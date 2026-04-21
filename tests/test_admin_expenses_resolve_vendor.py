"""Tests for expense vendor resolution."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api import admin_expenses_common
from app.api.admin_expenses_common import resolve_vendor
from app.exceptions import ValidationError


def test_resolve_vendor_raises_when_id_not_a_vendor_org(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_repo = MagicMock()
    mock_repo.get_vendor_by_id.return_value = None
    monkeypatch.setattr(
        admin_expenses_common,
        "OrganizationRepository",
        lambda _session: mock_repo,
    )
    vid = uuid4()
    with pytest.raises(ValidationError, match="vendor_id"):
        resolve_vendor(MagicMock(), vid)
    mock_repo.get_vendor_by_id.assert_called_once_with(vid)
