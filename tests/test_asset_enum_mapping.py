from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy.dialects import postgresql

from app.db.models.asset import Asset, AssetAccessGrant
from app.db.models.enums import AccessGrantType, AssetType, AssetVisibility


def _bind_value(column: Any, value: Any) -> Any:
    processor = column.type.bind_processor(postgresql.dialect())
    return processor(value) if processor is not None else value


def _read_value(column: Any, value: Any) -> Any:
    processor = column.type.result_processor(postgresql.dialect(), None)
    return processor(value) if processor is not None else value


@pytest.mark.parametrize(
    ("column", "enum_member", "db_label"),
    [
        (Asset.__table__.c.asset_type, AssetType.DOCUMENT, "document"),
        (Asset.__table__.c.visibility, AssetVisibility.RESTRICTED, "restricted"),
        (AssetAccessGrant.__table__.c.grant_type, AccessGrantType.ALL_AUTHENTICATED, "all_authenticated"),
    ],
)
def test_asset_enums_bind_postgres_labels(column: Any, enum_member: Any, db_label: str) -> None:
    assert db_label in column.type.enums
    assert _bind_value(column, enum_member) == db_label


@pytest.mark.parametrize(
    ("column", "enum_member", "db_label"),
    [
        (Asset.__table__.c.asset_type, AssetType.DOCUMENT, "document"),
        (Asset.__table__.c.visibility, AssetVisibility.RESTRICTED, "restricted"),
        (AssetAccessGrant.__table__.c.grant_type, AccessGrantType.ALL_AUTHENTICATED, "all_authenticated"),
    ],
)
def test_asset_enums_round_trip_db_labels(column: Any, enum_member: Any, db_label: str) -> None:
    assert _read_value(column, db_label) == enum_member
