"""Tests for vendor resolution from parsed invoice vendor names."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.db.repositories.organization import (
    OrganizationRepository,
    _normalize_vendor_match_name,
)


def test_normalize_vendor_match_name_collapses_whitespace() -> None:
    assert _normalize_vendor_match_name("  Acme  \n Co  ") == "Acme Co"


@pytest.fixture
def mock_session() -> MagicMock:
    return MagicMock()


def test_try_resolve_empty_string_skips_db(mock_session: MagicMock) -> None:
    repo = OrganizationRepository(mock_session)
    assert repo.try_resolve_active_vendor_by_parsed_name("  ") is None
    mock_session.execute.assert_not_called()


def test_try_resolve_exact_match_single_vendor(mock_session: MagicMock) -> None:
    vendor = SimpleNamespace(id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), name="Acme Co")
    result = MagicMock()
    result.scalars.return_value.all.return_value = [vendor]
    mock_session.execute.return_value = result

    repo = OrganizationRepository(mock_session)
    out = repo.try_resolve_active_vendor_by_parsed_name("  acme co  ")

    assert out is vendor
    assert mock_session.execute.call_count == 1


def test_try_resolve_exact_duplicate_returns_none(mock_session: MagicMock) -> None:
    o1 = SimpleNamespace(id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), name="X")
    o2 = SimpleNamespace(id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), name="X")
    result = MagicMock()
    result.scalars.return_value.all.return_value = [o1, o2]
    mock_session.execute.return_value = result

    repo = OrganizationRepository(mock_session)
    assert repo.try_resolve_active_vendor_by_parsed_name("X") is None
    assert mock_session.execute.call_count == 1


def test_try_resolve_fuzzy_used_when_exact_misses(mock_session: MagicMock) -> None:
    vendor = SimpleNamespace(
        id=UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"), name="Acme Limited HK"
    )
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    hit = MagicMock()
    hit.scalars.return_value.all.return_value = [vendor]
    mock_session.execute.side_effect = [empty, hit]

    repo = OrganizationRepository(mock_session)
    out = repo.try_resolve_active_vendor_by_parsed_name("Acme Limited")

    assert out is vendor
    assert mock_session.execute.call_count == 2


def test_try_resolve_fuzzy_ambiguous_returns_none(mock_session: MagicMock) -> None:
    """Short parsed names skip Tier 2; ambiguous multi-match is not evaluated."""
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = empty

    repo = OrganizationRepository(mock_session)
    assert repo.try_resolve_active_vendor_by_parsed_name("Acme") is None
    assert mock_session.execute.call_count == 1


def test_try_resolve_fuzzy_skipped_for_short_substring_query(mock_session: MagicMock) -> None:
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = empty

    repo = OrganizationRepository(mock_session)
    assert repo.try_resolve_active_vendor_by_parsed_name("Limited") is None
    assert mock_session.execute.call_count == 1


def test_try_resolve_fuzzy_skipped_when_only_generic_tokens(mock_session: MagicMock) -> None:
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = empty

    repo = OrganizationRepository(mock_session)
    assert repo.try_resolve_active_vendor_by_parsed_name("Limited Company Inc") is None
    assert mock_session.execute.call_count == 1
