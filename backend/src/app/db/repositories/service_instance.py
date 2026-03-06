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
    EventTicketTier,
    InstanceSessionSlot,
    InstanceStatus,
    ServiceInstance,
    TrainingInstanceDetails,
)
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
        """Return active enrollment count for capacity checks."""
        statement = (
            select(func.count(Enrollment.id))
            .where(Enrollment.instance_id == instance_id)
            .where(
                Enrollment.status.in_(
                    [
                        EnrollmentStatus.REGISTERED,
                        EnrollmentStatus.CONFIRMED,
                        EnrollmentStatus.COMPLETED,
                    ]
                )
            )
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
