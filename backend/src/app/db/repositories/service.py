"""Repository for service templates."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import (
    ConsultationDetails,
    EventDetails,
    Service,
    ServiceStatus,
    ServiceType,
    TrainingCourseDetails,
)
from app.db.repositories.base import BaseRepository

ServiceDetails = TrainingCourseDetails | EventDetails | ConsultationDetails | None


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters."""
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ServiceRepository(BaseRepository[Service]):
    """Repository for service CRUD and query operations."""

    def __init__(self, session: Session):
        super().__init__(session, Service)

    def list_services(
        self,
        *,
        limit: int,
        service_type: ServiceType | None = None,
        status: ServiceStatus | None = None,
        search: str | None = None,
        cursor_created_at: datetime | None = None,
        cursor_id: UUID | None = None,
    ) -> list[Service]:
        """List services with filters and stable cursor pagination."""
        statement = select(Service).options(
            joinedload(Service.training_course_details),
            joinedload(Service.event_details),
            joinedload(Service.consultation_details),
            selectinload(Service.tags),
        )
        if service_type is not None:
            statement = statement.where(Service.service_type == service_type)
        if status is not None:
            statement = statement.where(Service.status == status)
        if search:
            escaped = _escape_like_pattern(search.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    Service.title.ilike(pattern, escape="\\"),
                    Service.description.ilike(pattern, escape="\\"),
                )
            )
        if cursor_created_at is not None and cursor_id is not None:
            statement = statement.where(
                or_(
                    Service.created_at < cursor_created_at,
                    and_(
                        Service.created_at == cursor_created_at,
                        Service.id < cursor_id,
                    ),
                )
            )
        statement = statement.order_by(
            Service.created_at.desc(), Service.id.desc()
        ).limit(limit)
        return list(self._session.execute(statement).unique().scalars().all())

    def count_services(
        self,
        *,
        service_type: ServiceType | None = None,
        status: ServiceStatus | None = None,
        search: str | None = None,
    ) -> int:
        """Return service count for current filter set."""
        statement = select(func.count(Service.id))
        if service_type is not None:
            statement = statement.where(Service.service_type == service_type)
        if status is not None:
            statement = statement.where(Service.status == status)
        if search:
            escaped = _escape_like_pattern(search.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    Service.title.ilike(pattern, escape="\\"),
                    Service.description.ilike(pattern, escape="\\"),
                )
            )
        count = self._session.execute(statement).scalar_one_or_none()
        return int(count or 0)

    def get_by_id_with_details(self, service_id: UUID) -> Service | None:
        """Return a service with type details, tags, assets, and instances."""
        statement = (
            select(Service)
            .where(Service.id == service_id)
            .options(
                joinedload(Service.training_course_details),
                joinedload(Service.event_details),
                joinedload(Service.consultation_details),
                selectinload(Service.tags),
                selectinload(Service.assets),
                selectinload(Service.instances),
            )
        )
        return self._session.execute(statement).scalar_one_or_none()

    def create_service(self, service: Service, type_details: ServiceDetails) -> Service:
        """Create a service and optional type-specific detail row."""
        self._session.add(service)
        self._session.flush()
        if type_details is not None:
            if isinstance(type_details, TrainingCourseDetails):
                service.training_course_details = type_details
            elif isinstance(type_details, EventDetails):
                service.event_details = type_details
            elif isinstance(type_details, ConsultationDetails):
                service.consultation_details = type_details
            self._session.add(type_details)
            self._session.flush()
        self._session.refresh(service)
        return service

    def update_service(self, service: Service) -> Service:
        """Update and refresh a service."""
        return self.update(service)
