"""Registry of :class:`LegacyImporter` implementations."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.imports.base import LegacyImporter

_IMPORTERS: dict[str, LegacyImporter] = {}


def register(importer: LegacyImporter) -> None:
    """Register an importer; duplicate ``ENTITY`` raises."""
    key = importer.ENTITY
    if key in _IMPORTERS:
        msg = f"Duplicate legacy importer registration for entity={key!r}"
        raise ValueError(msg)
    _IMPORTERS[key] = importer


def get(entity: str) -> LegacyImporter:
    """Return importer or raise ``KeyError``."""
    return _IMPORTERS[entity]


def known_entities() -> list[str]:
    """Sorted list of registered entity keys."""
    return sorted(_IMPORTERS.keys())
