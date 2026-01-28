from typing import Dict, List, Optional

from app.db import session_scope
from app.repositories.events import list_public_events


def get_public_events(limit: int) -> List[Dict[str, Optional[str]]]:
    with session_scope() as session:
        return list_public_events(session, limit)
