"""Compile-time checks for admin family list search SQL."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.db.models import Family
from app.db.repositories.family import FamilyRepository


def test_admin_list_query_filter_compiles_for_postgres() -> None:
    """Guard against invalid EXISTS/correlation in family list search."""
    predicate = FamilyRepository._admin_list_query_filter("jo")
    stmt = select(Family.id).where(predicate)
    compiled = stmt.compile(
        dialect=postgresql.dialect(), compile_kwargs={"literal_binds": False}
    )
    sql = str(compiled).lower()
    assert "exists" in sql
    assert "family_members" in sql
