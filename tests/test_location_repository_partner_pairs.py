"""Unit tests for LocationRepository partner id/label pairs."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.db.repositories.location import LocationRepository


def test_active_partner_organization_id_label_pairs_dedupes_duplicate_org_rows() -> (
    None
):
    """Same org id must not appear twice for one location (stable name order)."""
    loc_id = uuid4()
    org_id = uuid4()
    other_org = uuid4()

    class _FakeResult:
        def all(self) -> list[tuple[Any, Any, Any]]:
            # Mimic SQL ``ORDER BY name ASC`` with duplicate org id collapsed by repo.
            return [
                (other_org, loc_id, "Alpha Partners"),
                (org_id, loc_id, "Zebra Co"),
                (org_id, loc_id, "Zebra Co"),
            ]

    class _FakeSession:
        def execute(self, _stmt: object) -> _FakeResult:
            return _FakeResult()

    repo = LocationRepository(_FakeSession())  # type: ignore[arg-type]
    out = repo.active_partner_organization_id_label_pairs_by_location_ids([loc_id])
    assert out[loc_id] == [(other_org, "Alpha Partners"), (org_id, "Zebra Co")]


def test_active_partner_organization_names_delegates_to_pairs() -> None:
    loc_id = uuid4()
    org_id = uuid4()

    class _FakeRepo(LocationRepository):
        def active_partner_organization_id_label_pairs_by_location_ids(
            self, location_ids: Any
        ) -> dict[Any, list[tuple[Any, str]]]:
            assert list(location_ids) == [loc_id]
            return {loc_id: [(org_id, "Partner A")]}

    class _FakeSession:
        pass

    repo = _FakeRepo(_FakeSession())  # type: ignore[arg-type]
    names = repo.active_partner_organization_names_by_location_ids([loc_id])
    assert names == {loc_id: ["Partner A"]}
