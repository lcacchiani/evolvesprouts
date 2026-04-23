"""Tests for public calendar repository query (list_public_offerings)."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock

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

    assert "services.service_type IN" in sql
    assert "'event'" in sql
    assert "'training_course'" in sql
    assert "services.status = 'published'" in sql
    assert "service_instances.status != 'cancelled'" in sql
    assert "service_instances.status IN" in sql
    assert "min(instance_session_slots.starts_at)" in sql.lower()
    assert "instance_session_slots.ends_at >=" in sql
    assert "ORDER BY" in sql.upper()
    assert "service_instances.id ASC" in sql


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


def test_list_public_offerings_landing_page_filter() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    slug = "may-2026-the-missing-piece"
    repo.list_public_offerings(limit=5, now=now, landing_page=slug)

    stmt = mock_session.execute.call_args[0][0]
    sql = _compiled_sql(stmt)
    assert f"service_instances.landing_page = '{slug}'" in sql


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


def test_list_public_offerings_eager_load_paths() -> None:
    mock_session = MagicMock()
    exec_result = MagicMock()
    exec_result.unique.return_value.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = exec_result

    repo = ServiceInstanceRepository(mock_session)
    now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    repo.list_public_offerings(limit=1, now=now)

    stmt = mock_session.execute.call_args[0][0]
    path_text = " ".join(str(opt.path) for opt in stmt._with_options)
    assert "ServiceInstance.session_slots" in path_text
    assert "InstanceSessionSlot.location" in path_text
    assert "ServiceInstance.location" in path_text
    assert "ServiceInstance.ticket_tiers" in path_text
    assert "ServiceInstance.training_details" in path_text
    assert "Service.event_details" in path_text
    assert "ServiceInstance.instance_tags" in path_text
    assert "ServiceInstanceTag.tag" in path_text
    assert "ServiceInstance.partner_organization_links" in path_text
    assert "ServiceInstancePartnerOrganization.organization" in path_text
