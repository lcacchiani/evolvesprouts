"""Ensure generated phone country regions are supported by backend phonenumbers."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import phonenumbers


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    paths = [
        repo / "apps/admin_web/src/lib/phone-countries.generated.ts",
        repo / "apps/public_www/src/lib/phone-countries.generated.ts",
    ]
    pattern = re.compile(r'"region":\s*"([A-Z]{2})"')
    for path in paths:
        text = path.read_text(encoding="utf-8")
        regions = pattern.findall(text)
        if not regions:
            print(f"No regions parsed from {path}", file=sys.stderr)
            return 1
        bad = [r for r in regions if r not in phonenumbers.SUPPORTED_REGIONS]
        if bad:
            print(f"Unsupported regions in {path}: {bad}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
