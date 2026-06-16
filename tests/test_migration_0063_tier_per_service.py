"""PostgreSQL integration: migration ``0063_tier_per_service`` tier split."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from uuid import UUID

import pytest

from tests.helpers.db import database_url
from sqlalchemy import create_engine, text

pytest.importorskip("psycopg", reason="psycopg required for DB integration test")


def _sqlalchemy_engine_url(url: str) -> str:
    if url.startswith("postgresql+") or url.startswith("postgres+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    return url


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _alembic_ini() -> Path:
    return _repo_root() / "backend" / "db" / "alembic.ini"


def _run_alembic(*args: str) -> None:
    env = {**os.environ, "DATABASE_URL": database_url() or ""}
    cmd = [sys.executable, "-m", "alembic", "-c", str(_alembic_ini()), *args]
    proc = subprocess.run(
        cmd,
        cwd=str(_repo_root()),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(
            f"alembic {' '.join(args)} failed:\n{proc.stdout}\n{proc.stderr}"
        )


PARENT_SVC = UUID("eeee0001-0001-4001-8001-000000000001")
ESS_TMPL = UUID("eeee0002-0001-4001-8001-000000000001")
DEEP_TMPL = UUID("eeee0002-0001-4001-8001-000000000002")
CHILD = UUID("eeee0003-0001-4001-8001-000000000001")
DISCOUNT = UUID("eeee0004-0001-4001-8001-000000000001")
SLOT = UUID("eeee0005-0001-4001-8001-000000000001")


@pytest.mark.skipif(database_url() is None, reason="TEST_DATABASE_URL not set")
def test_0063_splits_consultation_tiers_and_repoints_children() -> None:
    url = database_url()
    assert url is not None
    engine = create_engine(_sqlalchemy_engine_url(url))

    _run_alembic("upgrade", "0063_tier_per_service")
    _run_alembic("downgrade", "0061_per_booking_instances")

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO services (
                      id, service_type, title, service_key, booking_system, description,
                      cover_image_s3_key, delivery_mode, status, created_by,
                      service_tier, location_id
                    ) VALUES (
                      :id, 'consultation', 'Fixture Parent', 'family-consultation',
                      'consultation-booking', NULL, NULL, 'in_person', 'published',
                      'pytest-0063', NULL, NULL
                    )
                    """
                ),
                {"id": str(PARENT_SVC)},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO consultation_details (
                      service_id, consultation_format, max_group_size, duration_minutes,
                      pricing_model, default_hourly_rate, default_package_price,
                      default_package_sessions, default_currency
                    ) VALUES (
                      :sid, 'one_on_one', NULL, 60, 'hourly', 500.00, NULL, NULL, 'HKD'
                    )
                    """
                ),
                {"sid": str(PARENT_SVC)},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO service_instances (
                      id, service_id, slug, status, delivery_mode, created_by,
                      waitlist_enabled, eventbrite_sync_status, eventbrite_retry_count,
                      is_template, parent_instance_id
                    ) VALUES (
                      :id, :sid, :slug, 'open', 'in_person', 'pytest-0063',
                      FALSE, 'pending', 0, TRUE, NULL
                    )
                    """
                ),
                {
                    "id": str(ESS_TMPL),
                    "sid": str(PARENT_SVC),
                    "slug": "consultation-essentials-package",
                },
            )
            conn.execute(
                text(
                    """
                    INSERT INTO service_instances (
                      id, service_id, slug, status, delivery_mode, created_by,
                      waitlist_enabled, eventbrite_sync_status, eventbrite_retry_count,
                      is_template, parent_instance_id
                    ) VALUES (
                      :id, :sid, :slug, 'open', 'in_person', 'pytest-0063',
                      FALSE, 'pending', 0, TRUE, NULL
                    )
                    """
                ),
                {
                    "id": str(DEEP_TMPL),
                    "sid": str(PARENT_SVC),
                    "slug": "consultation-deep-dive-package",
                },
            )
            conn.execute(
                text(
                    """
                    INSERT INTO consultation_instance_details (
                      instance_id, pricing_model, price, currency, package_sessions
                    ) VALUES (:iid, 'hourly', 111.00, 'HKD', NULL)
                    """
                ),
                {"iid": str(ESS_TMPL)},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO consultation_instance_details (
                      instance_id, pricing_model, price, currency, package_sessions
                    ) VALUES (:iid, 'package', 222.00, 'HKD', 4)
                    """
                ),
                {"iid": str(DEEP_TMPL)},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO service_instances (
                      id, service_id, slug, status, delivery_mode, created_by,
                      waitlist_enabled, eventbrite_sync_status, eventbrite_retry_count,
                      is_template, parent_instance_id
                    ) VALUES (
                      :id, :sid, 'fixture-child-booking', 'open', 'in_person', 'pytest-0063',
                      FALSE, 'pending', 0, FALSE, :parent
                    )
                    """
                ),
                {"id": str(CHILD), "sid": str(PARENT_SVC), "parent": str(ESS_TMPL)},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO discount_codes (
                      id, code, description, discount_type, discount_value, currency,
                      valid_from, valid_until, service_id, instance_id,
                      max_uses, current_uses, active, created_by
                    ) VALUES (
                      :id, 'FIX0063', NULL, 'percentage', 10.00, NULL,
                      NULL, NULL, NULL, :iid, NULL, 0, TRUE, 'pytest-0063'
                    )
                    """
                ),
                {"id": str(DISCOUNT), "iid": str(ESS_TMPL)},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO instance_session_slots (
                      id, instance_id, template_instance_id, location_id,
                      starts_at, ends_at, sort_order
                    ) VALUES (
                      :id, :iid, :tid, NULL,
                      '2038-01-01T10:00:00+00', '2038-01-01T11:00:00+00', 0
                    )
                    """
                ),
                {"id": str(SLOT), "iid": str(CHILD), "tid": str(ESS_TMPL)},
            )

        _run_alembic("upgrade", "head")

        with engine.connect() as verify:
            ess_key = verify.execute(
                text(
                    "SELECT id FROM services WHERE service_key = "
                    "'family-consultation-essentials'"
                )
            ).scalar_one_or_none()
            deep_key = verify.execute(
                text(
                    "SELECT id FROM services WHERE service_key = "
                    "'family-consultation-deep-dive'"
                )
            ).scalar_one_or_none()
            assert ess_key is not None
            assert deep_key is not None

            row = verify.execute(
                text("SELECT service_tier FROM services WHERE id = CAST(:id AS uuid)"),
                {"id": str(ess_key)},
            ).scalar_one()
            assert row == "essentials"

            cd = verify.execute(
                text(
                    "SELECT default_hourly_rate::text FROM consultation_details "
                    "WHERE service_id = CAST(:id AS uuid)"
                ),
                {"id": str(ess_key)},
            ).scalar_one()
            assert cd == "111.00"

            child_svc = verify.execute(
                text(
                    "SELECT service_id FROM service_instances WHERE id = CAST(:id AS uuid)"
                ),
                {"id": str(CHILD)},
            ).scalar_one()
            assert UUID(str(child_svc)) == UUID(str(ess_key))

            # Migration 0063 clears parent linkage then drops ``parent_instance_id``.
            parent_col = verify.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE "
                    "table_name = 'service_instances' AND column_name = "
                    "'parent_instance_id'"
                )
            ).scalar_one()
            assert int(parent_col) == 0

            dc_svc, dc_inst = verify.execute(
                text(
                    "SELECT service_id, instance_id FROM discount_codes "
                    "WHERE id = CAST(:id AS uuid)"
                ),
                {"id": str(DISCOUNT)},
            ).one()
            assert UUID(str(dc_svc)) == UUID(str(ess_key))
            assert dc_inst is None

            purpose = verify.execute(
                text(
                    "SELECT purpose_service_id FROM instance_session_slots "
                    "WHERE id = CAST(:id AS uuid)"
                ),
                {"id": str(SLOT)},
            ).scalar_one()
            assert UUID(str(purpose)) == UUID(str(ess_key))

            tmpl_col = verify.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE "
                    "table_name = 'instance_session_slots' AND column_name = "
                    "'template_instance_id'"
                )
            ).scalar_one()
            assert int(tmpl_col) == 0

            legacy = verify.execute(
                text(
                    "SELECT COUNT(*) FROM services WHERE lower(trim(service_key)) = "
                    "'family-consultation' AND service_type::text = 'consultation'"
                )
            ).scalar_one()
            assert int(legacy) == 0

            skipped = verify.execute(
                text(
                    "SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
                    "WHERE t.typname = 'eventbrite_sync_status' AND e.enumlabel = 'skipped')"
                )
            ).scalar_one()
            assert skipped is True

    finally:
        with engine.begin() as cleanup:
            cleanup.execute(
                text("DELETE FROM instance_session_slots WHERE id = CAST(:id AS uuid)"),
                {"id": str(SLOT)},
            )
            cleanup.execute(
                text("DELETE FROM discount_codes WHERE id = CAST(:id AS uuid)"),
                {"id": str(DISCOUNT)},
            )
            cleanup.execute(
                text("DELETE FROM service_instances WHERE id = CAST(:id AS uuid)"),
                {"id": str(CHILD)},
            )
            cleanup.execute(
                text("DELETE FROM service_instances WHERE id IN (:a, :b)"),
                {"a": str(ESS_TMPL), "b": str(DEEP_TMPL)},
            )
            cleanup.execute(
                text(
                    "DELETE FROM consultation_details WHERE service_id = CAST(:id AS uuid)"
                ),
                {"id": str(PARENT_SVC)},
            )
            cleanup.execute(
                text("DELETE FROM services WHERE id = CAST(:id AS uuid)"),
                {"id": str(PARENT_SVC)},
            )
            for key in (
                "family-consultation-essentials",
                "family-consultation-deep-dive",
            ):
                cleanup.execute(
                    text(
                        "DELETE FROM consultation_details WHERE service_id IN "
                        "(SELECT id FROM services WHERE service_key = :k)"
                    ),
                    {"k": key},
                )
                cleanup.execute(
                    text("DELETE FROM services WHERE service_key = :k"),
                    {"k": key},
                )
