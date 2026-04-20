"""Legacy CRM importer protocol and shared types."""

from __future__ import annotations

from collections.abc import Mapping
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field
from dataclasses import replace
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


# Dependency entities that may legitimately have zero imported rows (empty tenant).
_OPTIONAL_LEGACY_IMPORT_DEPS: frozenset[str] = frozenset({"organizations"})


def parse_skip_legacy_keys_csv(raw: str | None) -> frozenset[str]:
    """Parse a comma-separated list of legacy primary-key strings to exclude from import."""
    if raw is None:
        return frozenset()
    s = raw.strip()
    if not s:
        return frozenset()
    parts = (p.strip() for p in s.split(","))
    return frozenset(p for p in parts if p)


@dataclass(frozen=True)
class ImporterContext:
    """Per-invocation context built in ``resolve_context``."""

    area_by_name: Mapping[str, UUID] = field(default_factory=dict)
    existing_keys: set[tuple[str, str]] = field(default_factory=set)
    refs_by_entity: Mapping[str, Mapping[str, UUID]] = field(default_factory=dict)
    #: Legacy keys already present in ``legacy_import_refs`` for this entity (idempotency).
    existing_import_keys: frozenset[str] = field(default_factory=frozenset)
    #: Optional legacy district id → label (venues tests / manual rows without labels).
    district_map: Mapping[int, str] | None = None
    #: Legacy row keys (string form of PK, e.g. venue id) to skip for this run.
    skip_legacy_keys: frozenset[str] = field(default_factory=frozenset)
    #: Full mysqldump text (optional; used by importers that need a second parse pass).
    source_sql_text: str | None = None
    #: Existing ``lower(email)`` / ``lower(instagram_handle)`` → contact id (contacts importer).
    email_to_contact_id: Mapping[str, UUID] = field(default_factory=dict)
    instagram_to_contact_id: Mapping[str, UUID] = field(default_factory=dict)


@dataclass
class ImportStats:
    """Summary of a legacy import run."""

    entity: str = ""
    inserted: int = 0
    skipped_duplicate: int = 0
    skipped_excluded_key: int = 0
    skipped_no_area: int = 0
    #: Usable address on family/org row but HK district could not be resolved to ``geographic_areas``.
    skipped_location_no_area: int = 0
    skipped_no_dep: int = 0
    skipped_deleted: int = 0
    #: Mapped to an existing contact by email/instagram dedupe (no new contact row).
    reused_existing_contact: int = 0
    dry_run: bool = False
    preview: list[str] = field(default_factory=list)
    #: Structured rows for logging / API (table, columns, values); capped per importer.
    row_details: list[dict[str, Any]] = field(default_factory=list)


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


def check_dependencies(
    importer: LegacyImporter,
    session: Session,
    *,
    dry_run: bool,
) -> None:
    """Raise ``DependencyNotMet`` for missing parent refs in non-dry-run mode."""
    if dry_run:
        return
    from app.imports import refs

    for dep in importer.DEPENDS_ON:
        if refs.has_mapping(session, dep):
            continue
        if dep in _OPTIONAL_LEGACY_IMPORT_DEPS:
            continue
        raise DependencyNotMet(
            f"Required dependency entity {dep!r} has no rows in "
            "legacy_import_refs; import that entity first."
        )


def resolve_importer_context(
    importer: LegacyImporter,
    session: Session,
    *,
    dry_run: bool,
    skip_legacy_keys: frozenset[str] | None = None,
    source_sql_text: str | None = None,
) -> ImporterContext:
    """Resolve importer context and attach dependency ref maps."""
    check_dependencies(importer, session, dry_run=dry_run)

    from app.imports import refs

    base_ctx = importer.resolve_context(session, dry_run=dry_run)
    refs_by = {dep: refs.load_mapping(session, dep) for dep in importer.DEPENDS_ON}
    merged_skip = frozenset(base_ctx.skip_legacy_keys)
    if skip_legacy_keys:
        merged_skip |= skip_legacy_keys
    existing_keys = base_ctx.existing_import_keys | refs.load_legacy_keys(
        session,
        importer.ENTITY,
    )
    sql_text = (
        source_sql_text if source_sql_text is not None else base_ctx.source_sql_text
    )
    merged_email = dict(base_ctx.email_to_contact_id)
    merged_insta = dict(base_ctx.instagram_to_contact_id)
    return replace(
        base_ctx,
        refs_by_entity=refs_by,
        skip_legacy_keys=merged_skip,
        existing_import_keys=existing_keys,
        source_sql_text=sql_text,
        email_to_contact_id=merged_email,
        instagram_to_contact_id=merged_insta,
    )
