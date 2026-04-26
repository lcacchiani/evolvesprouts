"""PostgreSQL integration: partner link bulk reconcile + session commit (ORM-safe)."""

from __future__ import annotations

import os
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.admin_service_instance_partners import reconcile_instance_partner_organizations
from app.db.models import (
    EventDetails,
    EventTicketTier,
    GeographicArea,
    Location,
    Organization,
    Service,
    ServiceInstance,
    ServiceInstancePartnerOrganization,
)
from app.db.models.enums import (
    EventCategory,
    InstanceStatus,
    OrganizationType,
    RelationshipType,
    ServiceDeliveryMode,
    ServiceStatus,
    ServiceType,
)
from app.db.repositories.location import LocationRepository
from app.db.repositories.service_instance import ServiceInstanceRepository

psycopg = pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


def _database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    return url or None


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_reconcile_partner_links_after_selectinload_commit_succeeds() -> None:
    """Mirrors admin PUT path: loaded instance + bulk reconcile + commit (no session.add)."""
    url = _database_url()
    assert url is not None
    engine = create_engine(url)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

    service_id = uuid4()
    instance_id = uuid4()
    area_id = uuid4()
    loc_id = uuid4()
    org_a = uuid4()
    org_b = uuid4()

    with SessionLocal() as session:
        session.add(
            GeographicArea(
                id=area_id,
                parent_id=None,
                name="Test Area",
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
                name=None,
                address="1 Integration St",
                lat=None,
                lng=None,
            )
        )
        session.add(
            Service(
                id=service_id,
                service_type=ServiceType.EVENT,
                title="Integration Event Service",
                slug=f"int-evt-{instance_id.hex[:8]}",
                booking_system=None,
                description=None,
                cover_image_s3_key=None,
                delivery_mode=ServiceDeliveryMode.IN_PERSON,
                status=ServiceStatus.PUBLISHED,
                created_by="pytest",
                location_id=None,
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
                id=instance_id,
                service_id=service_id,
                title="Instance",
                slug=f"int-inst-{instance_id.hex[:8]}",
                landing_page=None,
                description=None,
                cover_image_s3_key=None,
                status=InstanceStatus.SCHEDULED,
                delivery_mode=ServiceDeliveryMode.IN_PERSON,
                location_id=loc_id,
                max_capacity=None,
                waitlist_enabled=False,
                instructor_id=None,
                cohort=None,
                notes=None,
                external_url=None,
                created_by="pytest",
            )
        )
        session.add(
            EventTicketTier(
                instance_id=instance_id,
                name="workshop",
                description=None,
                price=Decimal("10.00"),
                currency="HKD",
                max_quantity=None,
                sort_order=0,
            )
        )
        for oid, name in ((org_a, "Partner A"), (org_b, "Partner B")):
            session.add(
                Organization(
                    id=oid,
                    name=name,
                    organization_type=OrganizationType.COMPANY,
                    relationship_type=RelationshipType.PARTNER,
                    website=None,
                    slug=None,
                    location_id=loc_id,
                    archived_at=None,
                )
            )
        session.add(
            ServiceInstancePartnerOrganization(
                service_instance_id=instance_id,
                organization_id=org_a,
                sort_order=0,
            )
        )
        session.add(
            ServiceInstancePartnerOrganization(
                service_instance_id=instance_id,
                organization_id=org_b,
                sort_order=1,
            )
        )
        session.commit()

    with SessionLocal() as session:
        repo = ServiceInstanceRepository(session)
        loaded = repo.get_by_id_with_details(instance_id)
        assert loaded is not None
        assert len(loaded.partner_organization_links) == 2
        reconcile_instance_partner_organizations(
            session,
            instance_id=instance_id,
            ordered_org_ids=[org_b, org_a],
        )
        session.commit()

    with SessionLocal() as session:
        rows = session.execute(
            select(
                ServiceInstancePartnerOrganization.organization_id,
                ServiceInstancePartnerOrganization.sort_order,
            )
            .where(ServiceInstancePartnerOrganization.service_instance_id == instance_id)
            .order_by(ServiceInstancePartnerOrganization.sort_order.asc())
        ).all()
        assert [r[0] for r in rows] == [org_b, org_a]
        assert [r[1] for r in rows] == [0, 1]


@pytest.mark.skipif(_database_url() is None, reason="TEST_DATABASE_URL not set")
def test_location_repository_two_partners_same_venue_distinct_ids() -> None:
    url = _database_url()
    assert url is not None
    engine = create_engine(url)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

    area_id = uuid4()
    loc_id = uuid4()
    org_a = uuid4()
    org_b = uuid4()

    with SessionLocal() as session:
        session.add(
            GeographicArea(
                id=area_id,
                parent_id=None,
                name="Area 2",
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
                name=None,
                address="Shared venue",
                lat=None,
                lng=None,
            )
        )
        session.add(
            Organization(
                id=org_a,
                name="Alpha Shared",
                organization_type=OrganizationType.NGO,
                relationship_type=RelationshipType.PARTNER,
                website=None,
                slug=None,
                location_id=loc_id,
                archived_at=None,
            )
        )
        session.add(
            Organization(
                id=org_b,
                name="Beta Shared",
                organization_type=OrganizationType.NGO,
                relationship_type=RelationshipType.PARTNER,
                website=None,
                slug=None,
                location_id=loc_id,
                archived_at=None,
            )
        )
        session.commit()

    with SessionLocal() as session:
        repo = LocationRepository(session)
        pairs = repo.active_partner_organization_id_label_pairs_by_location_ids([loc_id])
        assert loc_id in pairs
        ids_and_labels = pairs[loc_id]
        assert {oid for oid, _ in ids_and_labels} == {org_a, org_b}
        assert [label for _, label in ids_and_labels] == ["Alpha Shared", "Beta Shared"]
