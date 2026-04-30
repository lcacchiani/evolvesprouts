"""Tests for admin calendar manual blocks API."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.api import admin_calendar_manual_blocks as cal_blocks
from app.exceptions import ValidationError


@pytest.fixture
def _patch_session(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    session = MagicMock()

    class _Ctx:
        def __enter__(self) -> MagicMock:
            return session

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(cal_blocks, "Session", lambda _engine: _Ctx())
    monkeypatch.setattr(cal_blocks, "get_engine", lambda: object())
    return session


def test_create_duplicate_returns_409(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    _patch_session: MagicMock,
) -> None:
    repo = MagicMock()

    def _create_raises(_row: Any) -> None:
        raise IntegrityError("stmt", {}, Exception("dup"))

    repo.create.side_effect = _create_raises
    repo_cls = MagicMock(return_value=repo)
    monkeypatch.setattr(cal_blocks, "CalendarManualBlockRepository", repo_cls)
    monkeypatch.setattr(cal_blocks, "AuditService", MagicMock())

    body = {
        "purpose": "consultation_booking",
        "blockDate": "2026-05-01",
        "period": "am",
        "note": None,
    }
    event = api_gateway_event(
        method="POST",
        path="/v1/admin/calendar/manual-blocks",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    with pytest.raises(ValidationError) as exc:
        cal_blocks.handle_admin_calendar_manual_blocks_request(
            event, "POST", "/v1/admin/calendar/manual-blocks"
        )
    assert exc.value.status_code == 409


def test_update_partial_note_only_calls_flush_with_note_change(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    _patch_session: MagicMock,
) -> None:
    block_id = uuid4()
    row = SimpleNamespace(
        id=block_id,
        purpose="consultation_booking",
        block_date=date(2026, 5, 1),
        period="am",
        note="old",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        created_by="creator",
        updated_by=None,
        updated_at=None,
    )
    repo = MagicMock()
    repo.get_by_id.return_value = row
    monkeypatch.setattr(cal_blocks, "CalendarManualBlockRepository", MagicMock(return_value=repo))
    audit = MagicMock()
    monkeypatch.setattr(cal_blocks, "AuditService", MagicMock(return_value=audit))

    body = {"note": "new note"}
    event = api_gateway_event(
        method="PATCH",
        path=f"/v1/admin/calendar/manual-blocks/{block_id}",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )
    resp = cal_blocks.handle_admin_calendar_manual_blocks_request(
        event, "PATCH", f"/v1/admin/calendar/manual-blocks/{block_id}"
    )
    assert resp["statusCode"] == 200
    assert row.note == "new note"
    audit.log_update.assert_called_once()


def test_delete_calls_audit_delete(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
    _patch_session: MagicMock,
) -> None:
    block_id = uuid4()
    row = SimpleNamespace(
        id=block_id,
        purpose="consultation_booking",
        block_date=date(2026, 5, 1),
        period="am",
        note=None,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        created_by="creator",
    )
    repo = MagicMock()
    repo.get_by_id.return_value = row
    repo.delete_by_id.return_value = True
    monkeypatch.setattr(cal_blocks, "CalendarManualBlockRepository", MagicMock(return_value=repo))
    audit = MagicMock()
    monkeypatch.setattr(cal_blocks, "AuditService", MagicMock(return_value=audit))

    event = api_gateway_event(
        method="DELETE",
        path=f"/v1/admin/calendar/manual-blocks/{block_id}",
        authorizer_context=admin_identity,
    )
    resp = cal_blocks.handle_admin_calendar_manual_blocks_request(
        event, "DELETE", f"/v1/admin/calendar/manual-blocks/{block_id}"
    )
    assert resp["statusCode"] == 200
    audit.log_delete.assert_called_once()
