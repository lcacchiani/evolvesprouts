#!/usr/bin/env python3
"""Print My Best Auntie service instance UUIDs for public content editing.

Maps each training instance to a suggested content key
``{service_tier}::{cohort}`` (aligned with public calendar / CRM instance data)
when title text matches the expected pattern; otherwise uses ``unparsed::<uuid>``.

Local development only: refuses to connect unless ``ATTESTATION_FAIL_CLOSED``
is set to a falsey value (same gate as other local scripts) and you pass
``--execute``. Without ``--execute``, prints usage and exits 0.

Usage::

    python backend/scripts/dump_mba_instance_uuids.py
    ATTESTATION_FAIL_CLOSED=false python backend/scripts/dump_mba_instance_uuids.py --execute

Requires ``DATABASE_URL`` (or the same env vars as ``app.db.connection``).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Any

# Import after path setup
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.engine import get_engine  # noqa: E402
from app.db.models.service import Service  # noqa: E402
from app.db.models.service_instance import ServiceInstance  # noqa: E402


def _fail_closed_enabled() -> bool:
    raw = os.getenv("ATTESTATION_FAIL_CLOSED", "true").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _parse_age_and_cohort(title: str | None) -> tuple[str | None, str | None]:
    if not title:
        return None, None
    age = re.search(r"(\d+-\d+)", title)
    cohort = re.search(r"-\s*([A-Za-z]{3}\s*\d{2,4})\s*$", title)
    age_g = age.group(1) if age else None
    cohort_g = cohort.group(1).lower().replace(" ", "") if cohort else None
    return age_g, cohort_g


@dataclass(frozen=True)
class RowOut:
    service_instance_id: str
    instance_title: str | None
    suggested_key: str


def _fetch_rows() -> list[RowOut]:
    engine = get_engine(use_cache=False)
    with Session(engine) as session:
        stmt = (
            select(ServiceInstance, Service.title)
            .join(Service, Service.id == ServiceInstance.service_id)
            .where(Service.slug == "my-best-auntie")
            .order_by(ServiceInstance.created_at.asc())
        )
        rows: list[RowOut] = []
        for inst, service_title in session.execute(stmt).all():
            age, cohort = _parse_age_and_cohort(inst.title)
            if age and cohort:
                key = f"{age}::{cohort}"
            else:
                key = f"unparsed::{inst.id}"
            rows.append(
                RowOut(
                    service_instance_id=str(inst.id),
                    instance_title=inst.title,
                    suggested_key=key,
                )
            )
        return rows


def _build_fragment(rows: list[RowOut]) -> dict[str, Any]:
    by_key: dict[str, str] = {}
    for row in rows:
        by_key[row.suggested_key] = row.service_instance_id
    return {
        "service_slug": "my-best-auntie",
        "service_instance_id_by_suggested_key": by_key,
        "instances": [
            {
                "suggested_key": r.suggested_key,
                "service_instance_id": r.service_instance_id,
                "instance_title": r.instance_title,
            }
            for r in rows
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Connect to Aurora and print JSON (requires local dev gate).",
    )
    args = parser.parse_args()

    if not args.execute:
        print(
            "Dry run: no database connection.\n"
            "Pass --execute with ATTESTATION_FAIL_CLOSED=false (local dev only) "
            "to print instance UUIDs.\n"
            "Example:\n"
            "  ATTESTATION_FAIL_CLOSED=false python backend/scripts/dump_mba_instance_uuids.py --execute",
            file=sys.stderr,
        )
        return

    if _fail_closed_enabled():
        print(
            "Refusing to connect while ATTESTATION_FAIL_CLOSED is enabled. "
            "Set ATTESTATION_FAIL_CLOSED=false for trusted local development only.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    fragment = _build_fragment(_fetch_rows())
    print(json.dumps(fragment, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
