"""PostgreSQL integration: ``list_public_offerings`` filters on instance slug."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import (
    EventDetails,
    EventTicketTier,
    GeographicArea,
    Location,
    Service,
    ServiceInstance,
)
from app.db.models.enums import (
    EventCategory,
    InstanceStatus,
    ServiceDeliveryMode,
    ServiceStatus,
    ServiceType,
)
from app.db.models.service_instance import InstanceSessionSlot
from app.db.repositories.service_instance import ServiceInstanceRepository


def _database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


def _sqlalchemy_engine_url(url: str) -> str:
    """Use psycopg v3; bare ``postgresql://`` defaults to psycopg2 in SQLAlchemy."""
    if url.startswith("postgresql+") or url.startswith("postgres+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    return url


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_list_public_offerings_omits_null_slug_instances() -> None:
    url = _database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

    now = datetime.now(UTC)
    starts = now + timedelta(days=7)
    ends = starts + timedelta(hours=2)

    area_id = uuid4()
    loc_id = uuid4()
    service_id = uuid4()
    inst_null = uuid4()
    inst_slug = uuid4()

    with SessionLocal() as session:
        session.add(
            GeographicArea(
                id=area_id,
                parent_id=None,
                name="Area PO",
                name_translations={},
                level="country",
                code="HK",
                active=True,
                display_order=0,
                sovereign_country_id=None,
            )
        )
        session.add(
            Location(
                id=loc_id,
                area_id=area_id,
                name="Venue",
                address="1 St",
                lat=None,
                lng=None,
            )
        )
        session.add(
            Service(
                id=service_id,
                service_type=ServiceType.EVENT,
                title="Public Feed Svc",
                slug=f"pub-feed-{service_id.hex[:8]}",
                booking_system=None,
                description=None,
                cover_image_s3_key=None,
                delivery_mode=ServiceDeliveryMode.IN_PERSON,
                status=ServiceStatus.PUBLISHED,
                created_by="pytest",
                location_id=loc_id,
            )
        )
        session.add(
            EventDetails(
                service_id=service_id,
                event_category=EventCategory.WORKSHOP,
                default_price=Decimal("10.00"),
                default_currency="HKD",
            )
        )
        session.add(
            ServiceInstance(
                id=inst_null,
                service_id=service_id,
                title="No slug",
                slug=None,
                landing_page=None,
                description=None,
                cover_image_s3_key=None,
                status=InstanceStatus.SCHEDULED,
                delivery_mode=ServiceDeliveryMode.IN_PERSON,
                location_id=loc_id,
                max_capacity=10,
                waitlist_enabled=False,
                instructor_id=None,
                cohort=None,
                notes=None,
                external_url=None,
                created_by="pytest",
            )
        )
        session.add(
            ServiceInstance(
                id=inst_slug,
                service_id=service_id,
                title="Has slug",
                slug=f"pub-inst-{inst_slug.hex[:8]}",
                landing_page=None,
                description=None,
                cover_image_s3_key=None,
                status=InstanceStatus.SCHEDULED,
                delivery_mode=ServiceDeliveryMode.IN_PERSON,
                location_id=loc_id,
                max_capacity=10,
                waitlist_enabled=False,
                instructor_id=None,
                cohort=None,
                notes=None,
                external_url=None,
                created_by="pytest",
            )
        )
        for iid in (inst_null, inst_slug):
            session.add(
                InstanceSessionSlot(
                    instance_id=iid,
                    location_id=loc_id,
                    starts_at=starts,
                    ends_at=ends,
                    sort_order=0,
                )
            )
            session.add(
                EventTicketTier(
                    instance_id=iid,
                    name="workshop",
                    description=None,
                    price=Decimal("10.00"),
                    currency="HKD",
                    max_quantity=None,
                    sort_order=0,
                )
            )
        session.commit()

    with SessionLocal() as session:
        repo = ServiceInstanceRepository(session)
        rows = repo.list_public_offerings(limit=50, now=now)
        ids = [r.id for r in rows if r.id in (inst_null, inst_slug)]
        assert inst_null not in ids
        assert inst_slug in ids
