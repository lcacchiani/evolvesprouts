"""Tests for public calendar repository query (list_public_offerings)."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import UUID

from sqlalchemy.dialects import postgresql

from app.db.models.enums import ServiceType
from app.db.repositories.service_instance import ServiceInstanceRepository


def _compiled_sql(stmt: object) -> str:
    return str(
        stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )


def test_list_public_offerings_default_types_and_ordering_sql() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(limit=50, now=now)

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)

    assert "services.service_type IN ('event', 'training_course')" in sql
    assert "services.status = 'published'" in sql
    assert "service_instances.status != 'cancelled'" in sql
    assert "service_instances.status IN" in sql
    assert "min(instance_session_slots.starts_at)" in sql.lower()
    assert "instance_session_slots.ends_at >=" in sql
    assert "ORDER BY" in sql.upper()
    assert "service_instances.id ASC" in sql
    assert "service_instances.slug IS NOT NULL" in sql
    assert "service_instances.slug != ''" in sql


def test_list_public_offerings_service_type_event_only() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(
        limit=10,
        now=now,
        service_types={ServiceType.EVENT},
    )
    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "services.service_type IN ('event')" in sql


def test_list_public_offerings_service_key_filter() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(limit=5, now=now, service_key="my-best-auntie")

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "lower(services.slug) = 'my-best-auntie'" in sql
    assert "services.service_type IN ('event', 'training_course')" in sql
    assert "services.status = 'published'" in sql


def test_list_public_offerings_service_key_combines_with_other_filters() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(
        limit=5,
        now=now,
        service_types={ServiceType.TRAINING_COURSE},
        slug="foo-bar",
        service_key="my-best-auntie",
    )

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "lower(services.slug) = 'my-best-auntie'" in sql
    assert "lower(service_instances.slug) = 'foo-bar'" in sql
    assert "services.service_type IN ('training_course')" in sql


def test_list_public_offerings_service_key_not_applied_when_none() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(limit=5, now=now)

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "lower(services.slug)" not in sql


def test_list_public_offerings_slug_filter() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    slug = "may-2026-the-missing-piece"
    repo.list_public_offerings(limit=5, now=now, slug=slug)

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert f"lower(service_instances.slug) = '{slug}'" in sql


def test_list_event_instances_for_public_feed_wraps_list_public_offerings() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_event_instances_for_public_feed(limit=7, now=now)

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "'event'" in sql
    assert "'training_course'" not in sql


def test_list_public_offerings_empty_service_types_uses_default_in_order() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(limit=1, now=now, service_types=set())

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "services.service_type IN ('event', 'training_course')" in sql


def test_get_enrollment_counts_for_instances_empty_returns_empty() -> None:
    mock_session = MagicMock()
    repo = ServiceInstanceRepository(mock_session)
    assert repo.get_enrollment_counts_for_instances([]) == {}
    mock_session.execute.assert_not_called()


def test_get_enrollment_counts_for_instances_groups_by_instance() -> None:
    from uuid import UUID

    mock_session = MagicMock()
    row_a = (UUID(int=1), 3)
    row_b = (UUID(int=2), 1)
    mock_session.execute.return_value.all.return_value = [row_a, row_b]

    repo = ServiceInstanceRepository(mock_session)
    counts = repo.get_enrollment_counts_for_instances([UUID(int=1), UUID(int=2)])

    assert counts == {UUID(int=1): 3, UUID(int=2): 1}
    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert "GROUP BY" in sql.upper()
    assert "enrollments.instance_id" in sql


def test_get_id_by_slug_compiles_lower_match() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = UUID(int=99)
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    resolved = repo.get_id_by_slug("My-Cohort-Slug")

    assert resolved == UUID(int=99)
    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt).lower()
    assert "lower(service_instances.slug)" in sql
    assert "my-cohort-slug" in sql
