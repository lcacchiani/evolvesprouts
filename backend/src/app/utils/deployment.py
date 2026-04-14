"""Deployment stage helpers for production vs non-production behavior."""

from __future__ import annotations

import os

_VALID_STAGES = frozenset({"production", "staging"})


def _raw_stage() -> str:
    raw = os.getenv("DEPLOYMENT_STAGE", "staging").strip().lower()
    return raw if raw in _VALID_STAGES else "staging"


def is_production() -> bool:
    """True when ``DEPLOYMENT_STAGE`` is ``production``."""
    return _raw_stage() == "production"


def is_staging() -> bool:
    """True when ``DEPLOYMENT_STAGE`` is ``staging`` (including unknown values)."""
    return _raw_stage() == "staging"
