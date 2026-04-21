"""Compatibility tests for vendor listing via OrganizationRepository."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app.db.models import RelationshipType
from app.db.repositories.organization import OrganizationRepository


def _fake_org(
    *,
    oid: UUID,
    created_at: datetime,
    name: str = "Vendor Co",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=oid,
        name=name,
        relationship_type=RelationshipType.VENDOR,
        archived_at=None,
        created_at=created_at,
    )


@pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")
def test_list_organizations_vendor_scope_matches_list_vendors_row_set() -> None:
    """Vendor-filtered list returns the same rows the legacy list_vendors query would."""
    newer = datetime(2024, 6, 1, tzinfo=UTC)
    older = datetime(2024, 5, 1, tzinfo=UTC)
    id_new = uuid4()
    id_old = uuid4()
    vendor_new = _fake_org(oid=id_new, created_at=newer)
    vendor_old = _fake_org(oid=id_old, created_at=older)
    mock_session = MagicMock()
    list_result = MagicMock()
    list_result.scalars.return_value.unique.return_value.all.return_value = [
        vendor_new,
        vendor_old,
    ]
    count_result = MagicMock()
    count_result.scalar_one_or_none.return_value = 2
    mock_session.execute.side_effect = [list_result, count_result]

    repo = OrganizationRepository(mock_session)
    out = repo.list_organizations(
        limit=10,
        relationship_types=(RelationshipType.VENDOR,),
        include_relationships=False,
    )
    assert [r.id for r in out] == [id_new, id_old]

    assert (
        repo.count_organizations(relationship_types=(RelationshipType.VENDOR,))
        == 2
    )


def test_get_organization_by_id_includes_vendor_rows() -> None:
    vid = uuid4()
    vendor = _fake_org(oid=vid, created_at=datetime.now(UTC))
    mock_session = MagicMock()
    mock_session.execute.return_value.scalar_one_or_none.return_value = vendor
    repo = OrganizationRepository(mock_session)
    assert repo.get_organization_by_id(vid) is vendor
