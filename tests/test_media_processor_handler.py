from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest


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
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    assets = {
        "patience-free-guide": _FakeAsset(
            asset_id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Patience Guide",
        ),
        "sleep-routines": _FakeAsset(
            asset_id=UUID("22222222-2222-2222-2222-222222222222"),
            title="Sleep Routines Guide",
        ),
    }
    _patch_asset_repository(handler, monkeypatch, assets)

    resource_key, asset_id, tag_name, media_name = handler._resolve_media_resource(
        session=object(),
        message={"resource_key": "Sleep Routines"},
    )

    assert resource_key == "sleep-routines"
    assert asset_id == UUID("22222222-2222-2222-2222-222222222222")
    assert tag_name == "public-www-media-sleep-routines-requested"
    assert media_name == "Sleep Routines Guide"


def test_resolve_media_resource_uses_default_when_resource_key_missing(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    assets = {
        "patience-free-guide": _FakeAsset(
            asset_id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Patience Guide",
        )
    }
    _patch_asset_repository(handler, monkeypatch, assets)

    resource_key, asset_id, tag_name, media_name = handler._resolve_media_resource(
        session=object(),
        message={},
    )

    assert resource_key == "patience-free-guide"
    assert asset_id == UUID("11111111-1111-1111-1111-111111111111")
    assert tag_name == "public-www-media-patience-free-guide-requested"
    assert media_name == "Patience Guide"


def test_resolve_media_resource_falls_back_to_default_for_unknown_key(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    assets = {
        "patience-free-guide": _FakeAsset(
            asset_id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Patience Guide",
        )
    }
    _patch_asset_repository(handler, monkeypatch, assets)

    resource_key, asset_id, tag_name, media_name = handler._resolve_media_resource(
        session=object(),
        message={"resource_key": "not-in-map"},
    )

    assert resource_key == "patience-free-guide"
    assert asset_id == UUID("11111111-1111-1111-1111-111111111111")
    assert tag_name == "public-www-media-patience-free-guide-requested"
    assert media_name == "Patience Guide"


def test_resolve_media_resource_raises_when_default_asset_missing(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("MEDIA_DEFAULT_RESOURCE_KEY", "patience-free-guide")
    _patch_asset_repository(handler, monkeypatch, assets={})

    with pytest.raises(RuntimeError, match="No media asset found for resource key"):
        handler._resolve_media_resource(session=object(), message={})


class _FakeAsset:
    def __init__(self, *, asset_id: UUID, title: str):
        self.id = asset_id
        self.title = title


def _patch_asset_repository(
    handler: Any,
    monkeypatch: Any,
    assets: dict[str, _FakeAsset],
) -> None:
    class _FakeAssetRepository:
        def __init__(self, _session: Any):
            self._assets = assets

        def find_by_resource_key(self, resource_key: str) -> _FakeAsset | None:
            return self._assets.get(resource_key)

    monkeypatch.setattr(handler, "AssetRepository", _FakeAssetRepository)
