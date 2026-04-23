"""CRM default scope for organization list/count (vendor + partner excluded)."""

from __future__ import annotations

import app.db.repositories.organization as organization_module
from app.db.models import RelationshipType


def test_crm_default_relationship_tuple_excludes_vendor_and_partner() -> None:
    types = organization_module._CRM_DEFAULT_RELATIONSHIP_TYPES
    assert RelationshipType.VENDOR not in types
    assert RelationshipType.PARTNER not in types
    assert RelationshipType.PROSPECT in types
