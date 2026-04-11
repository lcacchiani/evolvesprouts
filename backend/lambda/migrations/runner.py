"""Migration execution helpers."""

from __future__ import annotations

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from app.utils.logging import get_logger

from .utils import _escape_config

logger = get_logger(__name__)


def _resolve_multi_head_version(database_url: str, config: Config) -> None:
    """Detect and fix stale multi-head state in alembic_version.

    A failed CloudFormation rollback can leave both the old and new revision
    stamped in alembic_version. Alembic refuses ``upgrade head`` in that state.
    If every stamped revision lies on a single linear chain, keep only the
    most-recent one so the normal upgrade path can resume.
    """
    engine = create_engine(database_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        rows = [r[0] for r in result]
        if len(rows) <= 1:
            return

        script = ScriptDirectory.from_config(config)
        ancestry: dict[str, int] = {}
        for rev_id in rows:
            depth = 0
            current = script.get_revision(rev_id)
            while current is not None:
                depth += 1
                down = current.down_revision
                if isinstance(down, tuple):
                    break
                current = script.get_revision(down) if down else None
            ancestry[rev_id] = depth

        latest = max(ancestry, key=ancestry.get)  # type: ignore[arg-type]
        stale = [r for r in rows if r != latest]
        logger.warning(
            "Detected multi-head alembic_version; pruning stale entries",
            extra={"keeping": latest, "removing": stale},
        )
        for rev_id in stale:
            conn.execute(
                text("DELETE FROM alembic_version WHERE version_num = :v"),
                {"v": rev_id},
            )
        conn.commit()
    engine.dispose()


def _run_migrations(database_url: str) -> None:
    """Run Alembic migrations to the latest head."""
    config = Config()
    config.set_main_option("script_location", "/var/task/db/alembic")
    config.set_main_option("sqlalchemy.url", _escape_config(database_url))
    _resolve_multi_head_version(database_url, config)
    command.upgrade(config, "head")
