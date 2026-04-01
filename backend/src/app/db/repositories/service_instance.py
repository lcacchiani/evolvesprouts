"""Repository for service instances and schedules."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import (
    ConsultationInstanceDetails,
    Enrollment,
    EnrollmentStatus,
    EventbriteSyncStatus,
    EventTicketTier,
    InstanceSessionSlot,
    InstanceStatus,
    Service,
    ServiceStatus,
    ServiceInstance,
    ServiceType,
    TrainingInstanceDetails,
)
from app.db.models.enums import CAPACITY_ENROLLMENT_STATUSES
from app.db.repositories.base import BaseRepository

InstanceDetails = (
    TrainingInstanceDetails | ConsultationInstanceDetails | list[EventTicketTier] | None
)


class ServiceInstanceRepository(BaseRepository[ServiceInstance]):
    """Repository for service-instance operations."""

    def __init__(self, session: Session):
        super().__init__(session, ServiceInstance)

    def list_instances(
        self,
        *,
        service_id: UUID,
        limit: int,
        status: InstanceStatus | None = None,
        cursor_created_at: datetime | None = None,
        cursor_id: UUID | None = None,
    ) -> list[ServiceInstance]:
        """List instances for a service with stable cursor pagination."""
        statement = (
            select(ServiceInstance)
            .where(ServiceInstance.service_id == service_id)
            .options(
                selectinload(ServiceInstance.session_slots),
                joinedload(ServiceInstance.training_details),
                joinedload(ServiceInstance.consultation_details),
                selectinload(ServiceInstance.ticket_tiers),
            )
        )
        if status is not None:
            statement = statement.where(ServiceInstance.status == status)
        if cursor_created_at is not None and cursor_id is not None:
            statement = statement.where(
                or_(
                    ServiceInstance.created_at < cursor_created_at,
                    and_(
                        ServiceInstance.created_at == cursor_created_at,
                        ServiceInstance.id < cursor_id,
                    ),
                )
            )
        statement = statement.order_by(
            ServiceInstance.created_at.desc(), ServiceInstance.id.desc()
        ).limit(limit)
        return list(self._session.execute(statement).unique().scalars().all())

    def count_instances(
        self,
        *,
        service_id: UUID,
        status: InstanceStatus | None = None,
    ) -> int:
        """Count instances by service and optional status."""
        statement = select(func.count(ServiceInstance.id)).where(
            ServiceInstance.service_id == service_id
        )
        if status is not None:
            statement = statement.where(ServiceInstance.status == status)
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def list_instances_global(
        self,
        *,
        limit: int,
        status: InstanceStatus | None = None,
        service_id: UUID | None = None,
        service_type: ServiceType | None = None,
        cursor_created_at: datetime | None = None,
        cursor_id: UUID | None = None,
    ) -> list[ServiceInstance]:
        """List instances across services with optional filters and cursor pagination."""
        statement = select(ServiceInstance).options(
            selectinload(ServiceInstance.session_slots),
            joinedload(ServiceInstance.training_details),
            joinedload(ServiceInstance.consultation_details),
            selectinload(ServiceInstance.ticket_tiers),
            joinedload(ServiceInstance.service),
        )
        if service_type is not None:
            statement = statement.join(
                Service, ServiceInstance.service_id == Service.id
            ).where(Service.service_type == service_type)
            if service_id is not None:
                statement = statement.where(ServiceInstance.service_id == service_id)
        elif service_id is not None:
            statement = statement.where(ServiceInstance.service_id == service_id)
        if status is not None:
            statement = statement.where(ServiceInstance.status == status)
        if cursor_created_at is not None and cursor_id is not None:
            statement = statement.where(
                or_(
                    ServiceInstance.created_at < cursor_created_at,
                    and_(
                        ServiceInstance.created_at == cursor_created_at,
                        ServiceInstance.id < cursor_id,
                    ),
                )
            )
        statement = statement.order_by(
            ServiceInstance.created_at.desc(), ServiceInstance.id.desc()
        ).limit(limit)
        return list(self._session.execute(statement).unique().scalars().all())

    def count_instances_global(
        self,
        *,
        status: InstanceStatus | None = None,
        service_id: UUID | None = None,
        service_type: ServiceType | None = None,
    ) -> int:
        """Count instances matching optional filters."""
        statement = select(func.count(ServiceInstance.id))
        if service_type is not None:
            statement = statement.join(
                Service, ServiceInstance.service_id == Service.id
            ).where(Service.service_type == service_type)
            if service_id is not None:
                statement = statement.where(ServiceInstance.service_id == service_id)
        elif service_id is not None:
            statement = statement.where(ServiceInstance.service_id == service_id)
        if status is not None:
            statement = statement.where(ServiceInstance.status == status)
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def get_by_id_with_details(self, instance_id: UUID) -> ServiceInstance | None:
        """Return one instance with related details and enrollments."""
        statement = (
            select(ServiceInstance)
            .where(ServiceInstance.id == instance_id)
            .options(
                selectinload(ServiceInstance.session_slots),
                joinedload(ServiceInstance.training_details),
                joinedload(ServiceInstance.consultation_details),
                selectinload(ServiceInstance.ticket_tiers),
                selectinload(ServiceInstance.enrollments),
            )
        )
        return self._session.execute(statement).scalar_one_or_none()

    def list_event_instances_for_public_feed(
        self,
        *,
        limit: int,
        now: datetime,
    ) -> list[ServiceInstance]:
        """List upcoming/past public event instances for calendar feed."""
        statement = (
            select(ServiceInstance)
            .join(Service, ServiceInstance.service_id == Service.id)
            .where(Service.service_type == ServiceType.EVENT)
            .where(Service.status == ServiceStatus.PUBLISHED)
            .where(ServiceInstance.status != InstanceStatus.CANCELLED)
            .where(
                ServiceInstance.status.in_(
                    [
                        InstanceStatus.SCHEDULED,
                        InstanceStatus.OPEN,
                        InstanceStatus.FULL,
                        InstanceStatus.IN_PROGRESS,
                        InstanceStatus.COMPLETED,
                    ]
                )
            )
            .where(
                ServiceInstance.session_slots.any(
                    InstanceSessionSlot.ends_at >= now - datetime.resolution
                )
            )
            .options(
                selectinload(ServiceInstance.session_slots),
                selectinload(ServiceInstance.ticket_tiers),
                joinedload(ServiceInstance.location),
                joinedload(ServiceInstance.service),
            )
            .order_by(ServiceInstance.created_at.desc(), ServiceInstance.id.desc())
            .limit(limit)
        )
        return list(self._session.execute(statement).unique().scalars().all())

    def list_instances_pending_eventbrite_sync(
        self, *, limit: int
    ) -> list[ServiceInstance]:
        """List Event-type instances that require Eventbrite sync work."""
        statement = (
            select(ServiceInstance)
            .join(Service, ServiceInstance.service_id == Service.id)
            .where(Service.service_type == ServiceType.EVENT)
            .where(
                ServiceInstance.eventbrite_sync_status.in_(
                    [EventbriteSyncStatus.PENDING, EventbriteSyncStatus.FAILED]
                )
            )
            .options(
                joinedload(ServiceInstance.service),
                selectinload(ServiceInstance.session_slots),
                selectinload(ServiceInstance.ticket_tiers),
            )
            .order_by(ServiceInstance.updated_at.asc(), ServiceInstance.id.asc())
            .limit(limit)
        )
        return list(self._session.execute(statement).unique().scalars().all())

    def create_instance(
        self,
        instance: ServiceInstance,
        type_details: InstanceDetails,
        session_slots: list[InstanceSessionSlot] | None = None,
    ) -> ServiceInstance:
        """Create an instance and optional nested detail rows."""
        self._session.add(instance)
        self._session.flush()

        for slot in session_slots or []:
            slot.instance_id = instance.id
            self._session.add(slot)

        if type_details is not None:
            if isinstance(type_details, TrainingInstanceDetails):
                instance.training_details = type_details
                type_details.instance_id = instance.id
                self._session.add(type_details)
            elif isinstance(type_details, ConsultationInstanceDetails):
                instance.consultation_details = type_details
                type_details.instance_id = instance.id
                self._session.add(type_details)
            else:
                for tier in type_details:
                    tier.instance_id = instance.id
                    self._session.add(tier)

        self._session.flush()
        self._session.refresh(instance)
        return instance

    def update_instance(self, instance: ServiceInstance) -> ServiceInstance:
        """Update and refresh an instance."""
        return self.update(instance)

    def get_enrollment_count(self, instance_id: UUID) -> int:
        """Return enrollment count for capacity (same statuses as EnrollmentRepository)."""
        statement = (
            select(func.count(Enrollment.id))
            .where(Enrollment.instance_id == instance_id)
            .where(Enrollment.status.in_(CAPACITY_ENROLLMENT_STATUSES))
        )
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def get_waitlist_count(self, instance_id: UUID) -> int:
        """Return waitlist count for an instance."""
        statement = (
            select(func.count(Enrollment.id))
            .where(Enrollment.instance_id == instance_id)
            .where(Enrollment.status == EnrollmentStatus.WAITLISTED)
        )
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def list_event_instances_for_sync_reconciliation(
        self,
        *,
        limit: int,
    ) -> list[ServiceInstance]:
        """Return Event instances ordered for periodic sync reconciliation."""
        statement = (
            select(ServiceInstance)
            .join(Service, ServiceInstance.service_id == Service.id)
            .where(Service.service_type == ServiceType.EVENT)
            .where(ServiceInstance.status != InstanceStatus.CANCELLED)
            .options(
                joinedload(ServiceInstance.service),
                joinedload(ServiceInstance.location),
                selectinload(ServiceInstance.session_slots),
                selectinload(ServiceInstance.ticket_tiers),
            )
            .order_by(ServiceInstance.updated_at.desc(), ServiceInstance.id.desc())
            .limit(limit)
        )
        return list(self._session.execute(statement).unique().scalars().all())
