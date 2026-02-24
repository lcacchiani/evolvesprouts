"""Pytest configuration for backend tests."""

from __future__ import annotations

import sys
from pathlib import Path

# Add backend source to path for imports.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))
