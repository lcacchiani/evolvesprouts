"""Repository pattern implementations for database operations.

Repositories provide a clean abstraction over database operations,
making business logic independent of the persistence layer.
"""

from app.db.repositories.base import BaseRepository
from app.db.repositories.asset import AssetRepository
from app.db.repositories.geographic_area import GeographicAreaRepository
from app.db.repositories.location import LocationRepository
from app.db.repositories.ticket import TicketRepository

__all__ = [
    "BaseRepository",
    "AssetRepository",
    "GeographicAreaRepository",
    "LocationRepository",
    "TicketRepository",
]
