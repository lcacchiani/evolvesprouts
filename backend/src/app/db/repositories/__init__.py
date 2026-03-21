"""Repository pattern implementations for database operations.

Repositories provide a clean abstraction over database operations,
making business logic independent of the persistence layer.
"""

from app.db.repositories.base import BaseRepository
from app.db.repositories.asset import AssetRepository
from app.db.repositories.contact import ContactRepository
from app.db.repositories.crm_note import CrmNoteRepository
from app.db.repositories.discount_code import DiscountCodeRepository
from app.db.repositories.enrollment import EnrollmentRepository
from app.db.repositories.expense import ExpenseRepository
from app.db.repositories.geographic_area import GeographicAreaRepository
from app.db.repositories.location import LocationRepository
from app.db.repositories.organization import OrganizationRepository
from app.db.repositories.sales_lead import SalesLeadRepository
from app.db.repositories.service import ServiceRepository
from app.db.repositories.service_instance import ServiceInstanceRepository
from app.db.repositories.ticket import TicketRepository

__all__ = [
    "BaseRepository",
    "AssetRepository",
    "ContactRepository",
    "CrmNoteRepository",
    "DiscountCodeRepository",
    "EnrollmentRepository",
    "ExpenseRepository",
    "GeographicAreaRepository",
    "LocationRepository",
    "OrganizationRepository",
    "SalesLeadRepository",
    "ServiceRepository",
    "ServiceInstanceRepository",
    "TicketRepository",
]
