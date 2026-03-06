from __future__ import annotations

from typing import Any

from sqlalchemy.dialects import postgresql

from app.db.models.enums import FunnelStage
from app.db.repositories.sales_lead import SalesLeadRepository


class _FakeResult:
    def __init__(self, *, rows: list[Any] | None = None, scalar: Any = None) -> None:
        self._rows = rows or []
        self._scalar = scalar

    def all(self) -> list[Any]:
        return self._rows

    def scalar_one_or_none(self) -> Any:
        return self._scalar


class _FakeSession:
    def __init__(self) -> None:
        self.statements: list[Any] = []

    def execute(self, statement: Any) -> _FakeResult:
        self.statements.append(statement)
        call_number = len(self.statements)

        if call_number == 1:
            return _FakeResult(rows=[(FunnelStage.NEW, 2)])
        if call_number == 2:
            return _FakeResult(scalar=None)
        if call_number == 3:
            return _FakeResult(rows=[])
        if call_number == 4:
            return _FakeResult(rows=[("2026-10", 2)])
        if call_number == 5:
            return _FakeResult(rows=[])
        if call_number == 6:
            return _FakeResult(rows=[])
        if call_number == 7:
            return _FakeResult(rows=[])

        raise AssertionError(f"Unexpected execute call #{call_number}")


def test_get_analytics_uses_stable_week_bucket_grouping() -> None:
    session = _FakeSession()
    repository = SalesLeadRepository(session)  # type: ignore[arg-type]

    analytics = repository.get_analytics()

    assert analytics["leads_over_time"] == [{"period": "2026-10", "count": 2}]
    assert len(session.statements) == 7

    leads_over_time_statement = session.statements[3]
    sql = str(
        leads_over_time_statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "FROM (SELECT" in sql
    assert "GROUP BY date_trunc('week', sales_leads.created_at)" in sql
    assert "ORDER BY date_trunc" not in sql
    assert "week_bucket ASC" in sql
