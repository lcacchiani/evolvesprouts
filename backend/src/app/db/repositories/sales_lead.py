"""Repository for CRM sales leads."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db.models.enums import FunnelStage, LeadEventType, LeadType
from app.db.models.sales_lead import SalesLead, SalesLeadEvent
from app.db.repositories.base import BaseRepository


class SalesLeadRepository(BaseRepository[SalesLead]):
    """Repository for sales lead and lead-event operations."""

    def __init__(self, session: Session):
        super().__init__(session, SalesLead)

    def find_by_contact_and_asset(
        self,
        contact_id: UUID,
        lead_type: LeadType,
        asset_id: UUID,
    ) -> SalesLead | None:
        """Return an existing lead for idempotent media processing."""
        statement = select(SalesLead).where(
            and_(
                SalesLead.contact_id == contact_id,
                SalesLead.lead_type == lead_type,
                SalesLead.asset_id == asset_id,
            )
        )
        return self._session.execute(statement).scalar_one_or_none()

    def create_with_event(
        self,
        lead: SalesLead,
        event_type: LeadEventType,
        metadata: dict[str, object] | None = None,
        *,
        from_stage: FunnelStage | None = None,
        to_stage: FunnelStage | None = None,
        created_by: str | None = None,
    ) -> SalesLead:
        """Create lead and initial lead event in one transaction scope."""
        self._session.add(lead)
        self._session.flush()
        self._session.refresh(lead)

        lead_event = SalesLeadEvent(
            lead_id=lead.id,
            event_type=event_type,
            from_stage=from_stage,
            to_stage=to_stage or lead.funnel_stage,
            metadata_json=metadata,
            created_by=created_by,
        )
        self._session.add(lead_event)
        self._session.flush()
        self._session.refresh(lead_event)

        return lead
