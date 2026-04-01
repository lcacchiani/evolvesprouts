"""Migration execution helpers."""

from __future__ import annotations

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.script.revision import ResolutionError
from psycopg.errors import UndefinedTable

from .utils import _escape_config, _psycopg_connect


def _load_current_revisions(database_url: str) -> tuple[str, ...]:
    """Read currently stamped revisions from alembic_version."""
    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            try:
                cursor.execute("SELECT version_num FROM alembic_version")
            except UndefinedTable:
                connection.rollback()
                return ()
            rows = cursor.fetchall()
    return tuple(str(row[0]) for row in rows if row and row[0])


def _find_redundant_revisions(
    script_dir: ScriptDirectory, current_revisions: tuple[str, ...]
) -> set[str]:
    """Return ancestors that are redundantly stamped alongside descendants."""
    if len(current_revisions) <= 1:
        return set()

    revision_map = script_dir.revision_map
    current_revision_set = set(current_revisions)
    redundant_revisions: set[str] = set()

    for revision_id in current_revisions:
        try:
            revision = revision_map.get_revision(revision_id)
        except ResolutionError:
            # Unknown revision IDs can happen during rollbacks; ignore safely.
            continue
        if revision is None:
            continue

        try:
            ancestors = revision_map._get_ancestor_nodes(  # noqa: SLF001 - Alembic graph utility
                (revision,),
                include_dependencies=True,
            )
        except ResolutionError:
            continue

        for ancestor in ancestors:
            ancestor_id = ancestor.revision
            if ancestor_id != revision_id and ancestor_id in current_revision_set:
                redundant_revisions.add(ancestor_id)

    return redundant_revisions


def _normalize_alembic_versions(config: Config, database_url: str) -> None:
    """Delete redundant ancestor rows from alembic_version."""
    current_revisions = _load_current_revisions(database_url)
    if len(current_revisions) <= 1:
        return

    script_dir = ScriptDirectory.from_config(config)
    redundant_revisions = _find_redundant_revisions(script_dir, current_revisions)
    if not redundant_revisions:
        return

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM alembic_version WHERE version_num = ANY(%s)",
                (sorted(redundant_revisions),),
            )
        connection.commit()


def _run_migrations(database_url: str) -> None:
    """Run Alembic migrations to the latest head."""
    config = Config()
    config.set_main_option("script_location", "/var/task/db/alembic")
    config.set_main_option("sqlalchemy.url", _escape_config(database_url))
    _normalize_alembic_versions(config, database_url)
    command.upgrade(config, "head")
