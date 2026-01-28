from typing import Dict, List, Optional

from app.db import session_scope
from app.repositories.families import list_families


def get_families(limit: int) -> List[Dict[str, Optional[str]]]:
    with session_scope() as session:
        return list_families(session, limit)
