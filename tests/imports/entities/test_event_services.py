"""Tests for event_services legacy importer and mapping helpers."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.db.models.enums import EventCategory
from app.db.models.enums import ServiceDeliveryMode
from app.db.models.enums import ServiceStatus
from app.db.models.enums import ServiceType
from app.imports.entities._legacy_event_common import DELIVERY_MODE_HYBRID_TOKENS
from app.imports.entities._legacy_event_common import DELIVERY_MODE_ONLINE_TOKENS
from app.imports.entities._legacy_event_common import LegacyEvent
from app.imports.entities._legacy_event_common import _infer_delivery_mode
from app.imports.entities._legacy_event_common import _map_event_category
from app.imports.entities._legacy_event_common import _slugify_event_title
from app.imports.entities.event_services import EventServicesImporter


def test_map_event_category_known() -> None:
    assert _map_event_category("workshop") == EventCategory.WORKSHOP
    assert _map_event_category("open_house") == EventCategory.OPEN_HOUSE


def test_map_event_category_unknown_warns(caplog: pytest.LogCaptureFixture) -> None:
    assert _map_event_category("alien_kind") == EventCategory.OTHER
    assert "unknown legacy event.category" in caplog.text


@pytest.mark.parametrize(
    ("title", "desc", "venue", "expected"),
    [
        ("Zoom night", None, None, ServiceDeliveryMode.ONLINE),
        ("Meet in person", None, "Community Hall", ServiceDeliveryMode.IN_PERSON),
        ("Hybrid day", None, None, ServiceDeliveryMode.HYBRID),
        ("Workshop", "online and in person", None, ServiceDeliveryMode.HYBRID),
    ],
)
def test_infer_delivery_mode(
    title: str,
    desc: str | None,
    venue: str | None,
    expected: ServiceDeliveryMode,
) -> None:
    assert _infer_delivery_mode(title, desc, venue) == expected


def test_delivery_mode_constants_documented() -> None:
    assert "zoom" in DELIVERY_MODE_ONLINE_TOKENS
    assert "hybrid" in DELIVERY_MODE_HYBRID_TOKENS


def test_slugify_event_title() -> None:
    assert _slugify_event_title("Hello — World!") == "hello-world"


def test_apply_skips_deleted_and_empty_title(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_services as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    new_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = new_id

    session.flush.side_effect = _flush
    session.execute.return_value.scalar_one.return_value = 0

    rows = [
        LegacyEvent(
            legacy_id=1,
            title=" ",
            description=None,
            category="workshop",
            default_price=None,
            default_currency="XX",
            default_venue_id=None,
            default_venue_name=None,
            organization_id=None,
            deleted_at=None,
        ),
        LegacyEvent(
            legacy_id=2,
            title="Ok",
            description=None,
            category="workshop",
            default_price=None,
            default_currency=None,
            default_venue_id=None,
            default_venue_name=None,
            organization_id=None,
            deleted_at="2020-01-01",
        ),
        LegacyEvent(
            legacy_id=3,
            title="Valid",
            description=None,
            category="workshop",
            default_price=None,
            default_currency="XX",
            default_venue_id=None,
            default_venue_name=None,
            organization_id=None,
            deleted_at=None,
        ),
    ]
    importer = EventServicesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(ImporterContext(), existing_import_keys=frozenset())
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_invalid_title == 1
    assert stats.skipped_deleted == 1
    assert stats.inserted == 1
    svc_objs = [c[0][0] for c in session.add.call_args_list]
    svc = next(o for o in svc_objs if type(o).__name__ == "Service")
    assert svc.service_type == ServiceType.EVENT
    assert svc.status == ServiceStatus.DRAFT


def test_slug_collision_probes(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_services as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    new_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = new_id

    session.flush.side_effect = _flush

    counts = iter([0, 1, 1, 0])

    def _exec(*_a: object, **_k: object) -> MagicMock:
        m = MagicMock()
        m.scalar_one.return_value = next(counts)
        return m

    session.execute.side_effect = _exec

    rows = [
        LegacyEvent(
            legacy_id=10,
            title="Sluggy",
            description=None,
            category="webinar",
            default_price=None,
            default_currency="HKD",
            default_venue_id=None,
            default_venue_name=None,
            organization_id=None,
            deleted_at=None,
        ),
        LegacyEvent(
            legacy_id=11,
            title="Sluggy",
            description=None,
            category="webinar",
            default_price=None,
            default_currency="HKD",
            default_venue_id=None,
            default_venue_name=None,
            organization_id=None,
            deleted_at=None,
        ),
    ]
    importer = EventServicesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(ImporterContext(), existing_import_keys=frozenset())
    importer.apply(session, rows, ctx, dry_run=False)
    svc_objs = [c[0][0] for c in session.add.call_args_list if type(c[0][0]).__name__ == "Service"]
    assert svc_objs[0].slug == "sluggy"
    assert svc_objs[1].slug == "sluggy-3"
