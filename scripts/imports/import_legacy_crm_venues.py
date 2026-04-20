#!/usr/bin/env python3
"""Shim — use ``import_legacy_crm.py venues`` instead."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent / "import_legacy_crm.py"


def main() -> int:
    print(
        "import_legacy_crm_venues.py is deprecated; use "
        f"python {_SCRIPT.name} venues <sql_path> [--dry-run]",
        file=sys.stderr,
    )
    argv = [sys.executable, str(_SCRIPT), "venues", *sys.argv[1:]]
    return subprocess.call(argv)


if __name__ == "__main__":
    raise SystemExit(main())
