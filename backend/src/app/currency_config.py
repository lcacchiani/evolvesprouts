"""Shared admin currency codes and symbols (repo `shared/config`).

The JSON file is the single source of truth for admin-web selectable currencies
and public discount-rule currency_symbol hints.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def _resolve_config_path() -> Path | None:
    here = Path(__file__).resolve()
    seen: set[Path] = set()
    for ancestor in here.parents:
        resolved = ancestor.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        candidate = (
            resolved / "shared" / "config" / "admin-selectable-currency-codes.json"
        )
        if candidate.is_file():
            return candidate
    return None


@lru_cache(maxsize=1)
def _load_currency_config() -> dict[str, Any]:
    path = _resolve_config_path()
    if path is None:
        return {"codes": [], "currencySymbols": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def clear_currency_config_cache() -> None:
    """Drop cached currency JSON (tests or hot reload)."""
    _load_currency_config.cache_clear()


def currency_symbol_for_iso_code(code: str | None) -> str | None:
    """Return display symbol for a 3-letter ISO code, or None if unknown."""
    if not code:
        return None
    normalized = code.strip().upper()
    if not normalized:
        return None
    symbols = _load_currency_config().get("currencySymbols") or {}
    raw = symbols.get(normalized)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None
