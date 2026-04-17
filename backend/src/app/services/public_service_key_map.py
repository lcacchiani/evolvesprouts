"""Resolve public website service_key slugs to Aurora service UUIDs."""

from __future__ import annotations

import json
import os
from uuid import UUID

from app.utils.logging import get_logger

logger = get_logger(__name__)

_ENV_KEY = "PUBLIC_SERVICE_KEY_MAP_JSON"


def load_public_service_key_map() -> dict[str, UUID]:
    """Parse PUBLIC_SERVICE_KEY_MAP_JSON into a slug -> UUID map."""
    raw = os.environ.get(_ENV_KEY, "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(
            "Invalid JSON for %s; discount scope mapping disabled",
            _ENV_KEY,
        )
        return {}
    if not isinstance(parsed, dict):
        logger.warning("%s must be a JSON object", _ENV_KEY)
        return {}
    out: dict[str, UUID] = {}
    for key, value in parsed.items():
        if not isinstance(key, str) or not key.strip():
            continue
        slug = key.strip().lower()
        if not isinstance(value, str) or not value.strip():
            continue
        try:
            out[slug] = UUID(value.strip())
        except ValueError:
            logger.warning(
                "Skipping invalid UUID for service key %s in %s",
                slug,
                _ENV_KEY,
            )
    return out


def resolve_service_id_for_public_key(
    service_key: str | None,
    *,
    service_id_override: UUID | None = None,
) -> UUID | None:
    """Return resolved service UUID from request.

    When both ``service_key`` and ``service_id_override`` are set,
    ``service_key`` wins (per public API contract).
    """
    if service_key is not None and service_key.strip():
        slug = service_key.strip().lower()
        mapping = load_public_service_key_map()
        resolved = mapping.get(slug)
        if resolved is None:
            logger.warning("Unknown public service_key in mapping", extra={"slug": slug})
        return resolved
    return service_id_override
