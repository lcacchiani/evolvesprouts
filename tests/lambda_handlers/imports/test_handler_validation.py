"""Lambda handler payload validation tests."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

_HANDLER_PATH = (
    Path(__file__).resolve().parents[3]
    / "backend"
    / "lambda"
    / "imports"
    / "legacy_crm"
    / "handler.py"
)


def _load_handler():
    spec = importlib.util.spec_from_file_location(
        "legacy_crm_handler_under_test",
        _HANDLER_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load handler")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_validate_requires_entity(mock_env: object) -> None:
    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="b")
    with pytest.raises(ValueError, match="entity"):
        h._validate_event(
            {"s3_bucket": "b", "s3_key": "k", "dry_run": True},
        )


def test_validate_unknown_entity(mock_env: object) -> None:
    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="b")
    with pytest.raises(ValueError, match="Unknown entity"):
        h._validate_event(
            {
                "entity": "nope",
                "s3_bucket": "b",
                "s3_key": "k",
                "dry_run": True,
            },
        )


def test_validate_wrong_bucket(mock_env: object) -> None:
    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="expected")
    with pytest.raises(ValueError, match="IMPORT_DUMP_BUCKET"):
        h._validate_event(
            {
                "entity": "venues",
                "s3_bucket": "other",
                "s3_key": "k",
                "dry_run": False,
            },
        )


def test_download_rejects_large(mock_env: object) -> None:
    from unittest.mock import patch

    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="b", MAX_IMPORT_DUMP_BYTES="10")
    s3 = MagicMock()
    s3.head_object.return_value = {"ContentLength": 99999}
    with patch.object(h, "get_s3_client", return_value=s3):
        with pytest.raises(ValueError, match="exceeds"):
            h._download_dump("b", "k.sql", "req-1")
