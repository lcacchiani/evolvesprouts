from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Family


def list_families(
    session: Session,
    limit: int,
) -> List[Dict[str, Optional[str]]]:
    families = (
        session.query(Family)
        .order_by(Family.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_family(item) for item in families]


def _serialize_family(family: Family) -> Dict[str, Optional[str]]:
    created_at = None
    if family.created_at:
        created_at = family.created_at.isoformat()
    return {
        'id': str(family.id),
        'name': family.name,
        'primary_email': family.primary_email,
        'created_at': created_at,
    }
