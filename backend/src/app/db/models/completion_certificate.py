"""Completion certificate records (issued training PDFs)."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DATE, TIMESTAMP

from app.db.base import Base
from app.db.models.enums import CompletionCertificateStatus

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.enrollment import Enrollment
    from app.db.models.organization import Organization
    from app.db.models.service import Service
    from app.db.models.service_instance import ServiceInstance


def _completion_certificate_status_values(
    _enum_cls: type[CompletionCertificateStatus] | None = None,
) -> list[str]:
    return [member.value for member in CompletionCertificateStatus]


class CompletionCertificate(Base):
    """Issued completion certificate linked to contact, instance, and enrollment."""

    __tablename__ = "completion_certificates"
    __table_args__ = (
        Index("completion_certificates_contact_idx", "contact_id"),
        Index("completion_certificates_instance_idx", "instance_id"),
        Index("completion_certificates_issued_at_idx", "issued_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    contact_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    instance_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="RESTRICT"),
        nullable=False,
    )
    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    enrollment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    partner_organization_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    participation_date: Mapped[date] = mapped_column(DATE(), nullable=False)
    recipient_display_name: Mapped[str] = mapped_column(Text(), nullable=False)
    program_title: Mapped[str] = mapped_column(Text(), nullable=False)
    partner_display_name: Mapped[str | None] = mapped_column(Text(), nullable=True)
    partner_signer_name: Mapped[str | None] = mapped_column(Text(), nullable=True)
    body_text: Mapped[str] = mapped_column(Text(), nullable=False)
    status: Mapped[CompletionCertificateStatus] = mapped_column(
        Enum(
            CompletionCertificateStatus,
            name="completion_certificate_status",
            values_callable=_completion_certificate_status_values,
            create_type=False,
        ),
        nullable=False,
        server_default=CompletionCertificateStatus.ISSUED.value,
    )
    issued_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )
    issued_by: Mapped[str] = mapped_column(Text(), nullable=False)
    voided_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    voided_by: Mapped[str | None] = mapped_column(Text(), nullable=True)
    issued_pdf_s3_key: Mapped[str | None] = mapped_column(Text(), nullable=True)
    issued_pdf_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pdf_template_version: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    contact: Mapped["Contact"] = relationship("Contact")
    instance: Mapped["ServiceInstance"] = relationship("ServiceInstance")
    service: Mapped["Service"] = relationship("Service")
    enrollment: Mapped["Enrollment"] = relationship("Enrollment")
    partner_organization: Mapped["Organization | None"] = relationship(
        "Organization"
    )
