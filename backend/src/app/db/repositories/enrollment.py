"""Repository for enrollment operations."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Enrollment, EnrollmentStatus, ServiceInstance
from app.db.repositories.base import BaseRepository


class EnrollmentRepository(BaseRepository[Enrollment]):
    """Repository for enrollment CRUD and list methods."""

    def __init__(self, session: Session):
        super().__init__(session, Enrollment)

    def list_enrollments(
        self,
        *,
        instance_id: UUID,
        limit: int,
        status: EnrollmentStatus | None = None,
        cursor_created_at: datetime | None = None,
        cursor_id: UUID | None = None,
    ) -> list[Enrollment]:
        """List enrollments by instance with stable cursor pagination."""
        statement = (
            select(Enrollment)
            .where(Enrollment.instance_id == instance_id)
            .options(
                joinedload(Enrollment.contact),
                joinedload(Enrollment.family),
                joinedload(Enrollment.organization),
                joinedload(Enrollment.ticket_tier),
                joinedload(Enrollment.discount_code),
            )
        )
        if status is not None:
            statement = statement.where(Enrollment.status == status)
        if cursor_created_at is not None and cursor_id is not None:
            statement = statement.where(
                or_(
                    Enrollment.created_at < cursor_created_at,
                    and_(
                        Enrollment.created_at == cursor_created_at,
                        Enrollment.id < cursor_id,
                    ),
                )
            )
        statement = statement.order_by(
            Enrollment.created_at.desc(), Enrollment.id.desc()
        ).limit(limit)
        return list(self._session.execute(statement).scalars().all())

    def count_enrollments(
        self,
        *,
        instance_id: UUID,
        status: EnrollmentStatus | None = None,
    ) -> int:
        """Count enrollments by instance and optional status."""
        statement = select(func.count(Enrollment.id)).where(
            Enrollment.instance_id == instance_id
        )
        if status is not None:
            statement = statement.where(Enrollment.status == status)
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def create_enrollment(self, enrollment: Enrollment) -> Enrollment:
        """Create enrollment with capacity guard where required."""
        instance_statement = select(ServiceInstance).where(
            ServiceInstance.id == enrollment.instance_id
        )
        instance = self._session.execute(instance_statement).scalar_one_or_none()
        if instance is None:
            raise ValueError("Service instance not found")

        if instance.max_capacity is not None:
            active_count = self.count_enrollments(
                instance_id=instance.id,
                status=EnrollmentStatus.CONFIRMED,
            ) + self.count_enrollments(
                instance_id=instance.id,
                status=EnrollmentStatus.REGISTERED,
            )
            if active_count >= instance.max_capacity:
                if instance.waitlist_enabled:
                    enrollment.status = EnrollmentStatus.WAITLISTED
                else:
                    raise ValueError("Instance capacity is full")

        self._session.add(enrollment)
        self._session.flush()
        self._session.refresh(enrollment)
        return enrollment

    def update_status(
        self, enrollment_id: UUID, status: EnrollmentStatus
    ) -> Enrollment | None:
        """Update enrollment status and return the updated row."""
        enrollment = self.get_by_id(enrollment_id)
        if enrollment is None:
            return None
        enrollment.status = status
        self._session.flush()
        self._session.refresh(enrollment)
        return enrollment
