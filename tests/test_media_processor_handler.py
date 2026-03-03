from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any
from uuid import UUID


def _load_handler_module() -> Any:
    module_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "lambda"
        / "media_processor"
        / "handler.py"
    )
    spec = importlib.util.spec_from_file_location(
        "test_media_processor_handler",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_resolve_media_resource_uses_requested_resource_key(monkeypatch: Any) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "4-ways-patience")
    monkeypatch.setenv(
        "MEDIA_RESOURCE_ASSET_IDS_JSON",
        (
            '{"4-ways-patience":"11111111-1111-1111-1111-111111111111",'
            '"sleep-routines":"22222222-2222-2222-2222-222222222222"}'
        ),
    )

    resource_key, asset_id, tag_name = handler._resolve_media_resource(
        {"resource_key": "Sleep Routines"}
    )

    assert resource_key == "sleep-routines"
    assert asset_id == UUID("22222222-2222-2222-2222-222222222222")
    assert tag_name == "public-www-free-guide-sleep-routines-requested"


def test_resolve_media_resource_uses_default_when_resource_key_missing(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "4-ways-patience")
    monkeypatch.setenv(
        "MEDIA_RESOURCE_ASSET_IDS_JSON",
        '{"4-ways-patience":"11111111-1111-1111-1111-111111111111"}',
    )

    resource_key, asset_id, tag_name = handler._resolve_media_resource({})

    assert resource_key == "4-ways-patience"
    assert asset_id == UUID("11111111-1111-1111-1111-111111111111")
    assert tag_name == "public-www-free-guide-4-ways-patience-requested"


def test_resolve_media_resource_falls_back_to_default_for_unknown_key(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "4-ways-patience")
    monkeypatch.setenv(
        "MEDIA_RESOURCE_ASSET_IDS_JSON",
        '{"4-ways-patience":"11111111-1111-1111-1111-111111111111"}',
    )

    resource_key, asset_id, tag_name = handler._resolve_media_resource(
        {"resource_key": "not-in-map"}
    )

    assert resource_key == "4-ways-patience"
    assert asset_id == UUID("11111111-1111-1111-1111-111111111111")
    assert tag_name == "public-www-free-guide-4-ways-patience-requested"
