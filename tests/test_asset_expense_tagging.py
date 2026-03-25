from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID

from app.services.asset_expense_tagging import (
    EXPENSE_ATTACHMENT_TAG_NAME,
    sync_expense_attachment_tags_for_assets,
)


def test_sync_expense_attachment_tags_noop_for_empty_set() -> None:
    session = MagicMock()
    sync_expense_attachment_tags_for_assets(session, set())
    session.execute.assert_not_called()


def test_sync_expense_attachment_tags_skips_when_no_tag_row() -> None:
    session = MagicMock()
    first = MagicMock()
    first.scalar_one_or_none.return_value = None
    session.execute.return_value = first

    sync_expense_attachment_tags_for_assets(
        session, {UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")}
    )

    assert session.execute.call_count == 1


def test_expense_attachment_tag_name_constant() -> None:
    assert EXPENSE_ATTACHMENT_TAG_NAME == "expense_attachment"
