"""Tests for legacy CRM venues import Lambda handler."""

from __future__ import annotations

import importlib.util
import sys
from functools import lru_cache
from pathlib import Path
from unittest.mock import MagicMock
from unittest.mock import patch

import pytest

from app.imports.legacy_crm_venues import ImportStats

_HANDLER_PATH = (
    Path(__file__).resolve().parents[3]
    / "backend"
    / "lambda"
    / "imports"
    / "legacy_crm_venues"
    / "handler.py"
)


@lru_cache(maxsize=1)
def _handler():
    """Load handler module without relying on the top-level name ``lambda`` in imports."""
    spec = importlib.util.spec_from_file_location(
        "legacy_crm_venues_handler_under_test",
        _HANDLER_PATH,
    )
    if spec is None or spec.loader is None:
        msg = f"Cannot load handler from {_HANDLER_PATH}"
        raise RuntimeError(msg)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_validate_rejects_unknown_keys() -> None:
    h = _handler()
    with pytest.raises(ValueError, match="Unknown event keys"):
        h._validate_event({"s3_bucket": "b", "s3_key": "k", "dry_run": True, "extra": 1})


def test_validate_rejects_wrong_bucket(mock_env: object) -> None:
    h = _handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="expected-bucket")
    with pytest.raises(ValueError, match="does not match"):
        h._validate_event(
            {
                "s3_bucket": "other-bucket",
                "s3_key": "dumps/x.sql",
                "dry_run": False,
            }
        )


def test_validate_accepts_matching_bucket(mock_env: object) -> None:
    h = _handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="expected-bucket")
    out = h._validate_event(
        {
            "s3_bucket": "expected-bucket",
            "s3_key": "dumps/1/x.sql",
            "dry_run": True,
        }
    )
    assert out["dry_run"] is True


def test_download_rejects_large_object(mock_env: object) -> None:
    h = _handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="b", MAX_IMPORT_DUMP_BYTES="100")
    s3 = MagicMock()
    s3.head_object.return_value = {"ContentLength": 999999}

    with patch.object(h, "get_s3_client", return_value=s3):
        with pytest.raises(ValueError, match="exceeds MAX_IMPORT_DUMP_BYTES"):
            h._download_dump("b", "k.sql")


def test_lambda_handler_happy_path(mock_env: object, monkeypatch: pytest.MonkeyPatch) -> None:
    h = _handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="my-bucket", MAX_IMPORT_DUMP_BYTES="2097152")

    sql = """
INSERT INTO district (id, name) VALUES (1, 'Central');
INSERT INTO venue (id, name, address_line1, address_line2, district_id) VALUES
(1, 'V', 'A', NULL, 1);
"""

    s3 = MagicMock()
    s3.head_object.return_value = {"ContentLength": len(sql.encode("utf-8"))}

    def _download(_b: str, _k: str, dest: str) -> None:
        Path(dest).write_text(sql, encoding="utf-8")

    s3.download_file.side_effect = _download

    stats = ImportStats(
        inserted=0,
        skipped_duplicate=0,
        skipped_no_area=1,
        dry_run=True,
        preview=[],
    )

    monkeypatch.setattr(h, "parse_legacy_districts", lambda _t: {1: "Central"})
    monkeypatch.setattr(h, "parse_legacy_venues", lambda _t, districts=None: [])
    monkeypatch.setattr(h, "get_engine", MagicMock())

    class _FakeSession:
        def __init__(self, _engine: object) -> None:
            pass

        def __enter__(self) -> MagicMock:
            return MagicMock()

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(h, "Session", _FakeSession)

    def _apply(_session: object, _venues: object, *, dry_run: bool) -> ImportStats:
        assert dry_run is True
        return stats

    monkeypatch.setattr(h, "apply_venues", _apply)

    with patch.object(h, "get_s3_client", return_value=s3):
        result = h.lambda_handler(
            {"s3_bucket": "my-bucket", "s3_key": "dumps/1/f.sql", "dry_run": True},
            None,
        )

    assert result["dry_run"] is True
    assert result["skipped_no_area"] == 1
    s3.head_object.assert_called_once()
    s3.download_file.assert_called_once()
