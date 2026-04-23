"""Tests for event_instances legacy importer."""

from __future__ import annotations

import uuid
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.db.models.enums import InstanceStatus
from app.imports.entities._legacy_event_common import LegacyEventDate
from app.imports.entities.event_instances import EventInstancesImporter


def _past() -> datetime:
    return datetime.now(UTC) - timedelta(days=7)


def _future() -> datetime:
    return datetime.now(UTC) + timedelta(days=7)


def test_status_cancelled_overrides_past(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instances as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    inst_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = inst_id

    session.flush.side_effect = _flush

    past_start = _past()
    past_end = past_start + timedelta(hours=2)
    rows = [
        LegacyEventDate(
            legacy_id=1,
            event_id=99,
            starts_at=past_start,
            ends_at=past_end,
            venue_id=None,
            capacity=10,
            cancelled_at="2020-01-01 00:00:00",
            deleted_at=None,
            notes=None,
            external_url=None,
        ),
    ]
    svc_id = uuid.uuid4()
    importer = EventInstancesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_services": {"99": svc_id},
            "venues": {},
            "organizations": {},
        },
        event_service_slug_by_uuid={str(svc_id): "evt"},
        source_sql_text="",
    )
    importer.apply(session, rows, ctx, dry_run=False)
    inst = session.add.call_args_list[0][0][0]
    assert inst.status == InstanceStatus.CANCELLED


def test_deleted_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instances as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    importer = EventInstancesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    fut = _future()
    rows = [
        LegacyEventDate(
            legacy_id=2,
            event_id=1,
            starts_at=fut,
            ends_at=fut + timedelta(hours=1),
            venue_id=None,
            capacity=None,
            cancelled_at=None,
            deleted_at="x",
            notes=None,
            external_url=None,
        ),
    ]
    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_services": {"1": uuid.uuid4()},
            "venues": {},
            "organizations": {},
        },
        source_sql_text="",
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_deleted == 1


def test_invalid_range_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instances as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    importer = EventInstancesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    t = _future()
    rows = [
        LegacyEventDate(
            legacy_id=3,
            event_id=1,
            starts_at=t + timedelta(hours=2),
            ends_at=t,
            venue_id=None,
            capacity=None,
            cancelled_at=None,
            deleted_at=None,
            notes=None,
            external_url=None,
        ),
    ]
    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_services": {"1": uuid.uuid4()},
            "venues": {},
            "organizations": {},
        },
        source_sql_text="",
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_invalid_range == 1


def test_partner_org_link_when_org_mapped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instances as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    inst_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = inst_id

    session.flush.side_effect = _flush

    svc_id = uuid.uuid4()
    org_id = uuid.uuid4()
    fut = _future()
    sql = """
CREATE TABLE `event` (
  `id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text,
  `category` varchar(64) DEFAULT NULL,
  `default_price` decimal(10,2) DEFAULT NULL,
  `default_currency` char(3) DEFAULT NULL,
  `default_venue_id` int DEFAULT NULL,
  `organization_id` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
INSERT INTO `event` (`id`,`name`,`description`,`category`,`default_price`,`default_currency`,`default_venue_id`,`organization_id`,`deleted_at`) VALUES (77,'T','d','workshop',NULL,'HKD',NULL,88,NULL);
"""
    rows = [
        LegacyEventDate(
            legacy_id=20,
            event_id=77,
            starts_at=fut,
            ends_at=fut + timedelta(hours=2),
            venue_id=None,
            capacity=None,
            cancelled_at=None,
            deleted_at=None,
            notes=None,
            external_url=None,
        ),
    ]
    importer = EventInstancesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_services": {"77": svc_id},
            "venues": {},
            "organizations": {"88": org_id},
        },
        event_service_slug_by_uuid={str(svc_id): "myevt"},
        source_sql_text=sql,
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.partner_org_links_inserted == 1
    assert stats.partner_org_skipped_unmapped == 0
    partner = next(
        c[0][0]
        for c in session.add.call_args_list
        if type(c[0][0]).__name__ == "ServiceInstancePartnerOrganization"
    )
    assert partner.organization_id == org_id


def test_partner_org_skipped_unmapped_counter(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instances as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    inst_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = inst_id

    session.flush.side_effect = _flush
    svc_id = uuid.uuid4()
    fut = _future()
    sql = """
CREATE TABLE `event` (
  `id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text,
  `category` varchar(64) DEFAULT NULL,
  `default_price` decimal(10,2) DEFAULT NULL,
  `default_currency` char(3) DEFAULT NULL,
  `default_venue_id` int DEFAULT NULL,
  `organization_id` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
INSERT INTO `event` (`id`,`name`,`description`,`category`,`default_price`,`default_currency`,`default_venue_id`,`organization_id`,`deleted_at`) VALUES (77,'T','d','workshop',NULL,'HKD',NULL,88,NULL);
"""
    rows = [
        LegacyEventDate(
            legacy_id=21,
            event_id=77,
            starts_at=fut,
            ends_at=fut + timedelta(hours=2),
            venue_id=None,
            capacity=None,
            cancelled_at=None,
            deleted_at=None,
            notes=None,
            external_url=None,
        ),
    ]
    importer = EventInstancesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_services": {"77": svc_id},
            "venues": {},
            "organizations": {},
        },
        event_service_slug_by_uuid={str(svc_id): "myevt"},
        source_sql_text=sql,
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.partner_org_skipped_unmapped == 1
    assert stats.partner_org_links_inserted == 0


def test_dry_run_preview_includes_slug(monkeypatch: pytest.MonkeyPatch) -> None:
    session = MagicMock(spec=Session)
    fut = _future()
    rows = [
        LegacyEventDate(
            legacy_id=30,
            event_id=1,
            starts_at=fut,
            ends_at=fut + timedelta(hours=1),
            venue_id=None,
            capacity=None,
            cancelled_at=None,
            deleted_at=None,
            notes=None,
            external_url=None,
        ),
    ]
    svc_id = uuid.uuid4()
    importer = EventInstancesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_services": {"1": svc_id},
            "venues": {},
            "organizations": {},
        },
        event_service_slug_by_uuid={str(svc_id): "slugbase"},
        source_sql_text="",
    )
    stats = importer.apply(session, rows, ctx, dry_run=True)
    assert any("slug=slugbase-" in p for p in stats.preview)
