"""Legacy CRM importer protocol and shared types."""

from __future__ import annotations

from collections.abc import Mapping
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field
from typing import Any
from typing import ClassVar
from typing import Protocol
from typing import runtime_checkable
from uuid import UUID

from sqlalchemy.orm import Session

from app.utils.logging import mask_email
from app.utils.logging import mask_pii


class DependencyNotMet(RuntimeError):
    """Raised when a non-dry-run import needs parent rows in legacy_import_refs."""


@dataclass(frozen=True)
class ImporterContext:
    """Per-invocation context built in ``resolve_context``."""

    area_by_name: Mapping[str, UUID] = field(default_factory=dict)
    existing_keys: set[tuple[str, str]] = field(default_factory=set)
    refs_by_entity: Mapping[str, Mapping[str, UUID]] = field(default_factory=dict)
    #: Optional legacy district id → label (venues tests / manual rows without labels).
    district_map: Mapping[int, str] | None = None


@dataclass
class ImportStats:
    """Summary of a legacy import run."""

    entity: str = ""
    inserted: int = 0
    skipped_duplicate: int = 0
    skipped_no_area: int = 0
    skipped_no_dep: int = 0
    dry_run: bool = False
    preview: list[str] = field(default_factory=list)


@runtime_checkable
class LegacyImporter(Protocol):
    """Pluggable importer for one legacy CRM entity."""

    ENTITY: ClassVar[str]
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = False
    PREVIEW_MAX_ROWS: ClassVar[int] = 50

    def parse(self, sql_text: str) -> Sequence[Any]:
        """Parse mysqldump text into row records."""
        ...

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        """Load DB state needed before ``apply``."""
        ...

    def apply(
        self,
        session: Session,
        rows: Sequence[Any],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        """Apply rows; commit is owned by the caller or ``apply`` implementation."""
        ...

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        """One preview line for dry-run (may include PII — use ``preview_line`` helper)."""
        ...


def preview_line(importer: LegacyImporter, text: str) -> str:
    """Apply masking when ``PII`` is True."""
    if importer.PII:
        return mask_pii(text)
    return text


def preview_line_email(importer: LegacyImporter, text: str) -> str:
    """Mask email segments when PII."""
    if importer.PII:
        return mask_email(text)
    return text
