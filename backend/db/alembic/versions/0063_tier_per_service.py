"""Tier-per-service consultations; drop template instance row pattern.

Splits ``family-consultation`` tier templates into dedicated ``services`` rows,
re-points booking children and discounts, replaces ``template_instance_id`` race
key with ``purpose_service_id`` (FK to ``services``), and removes
``consultation_instance_details`` plus ``is_template`` / ``parent_instance_id``.

**Upgrade**

Uses a whitelist of consultation tier template slugs; fails fast if additional
``is_template`` consultation rows exist.

**Downgrade**

Best-effort and **lossy** once production bookings accumulate after upgrade:
schema is restored toward the ``0061_per_booking_instances`` shape, but merged
catalog/pricing and slot tagging cannot always reconstruct pre-upgrade semantics.

Revision id: ``0063_tier_per_service`` (22 chars, <= 32).

Seed audit: no ``seed_data.sql`` row edits; see inline comment there on legacy key block.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0063_tier_per_service"
down_revision: Union[str, None] = "0062_eventbrite_skipped"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TIER_SERVICE_KEY_CASE = """CASE
    WHEN lower(tmpl.slug) = 'consultation-essentials-package'
      THEN 'family-consultation-essentials'
    WHEN lower(tmpl.slug) = 'consultation-deep-dive-package'
      THEN 'family-consultation-deep-dive'
  END"""


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM service_instances si
            JOIN services p ON p.id = si.service_id
            WHERE si.is_template IS TRUE
              AND p.service_type::text = 'consultation'
              AND lower(si.slug) NOT IN (
                'consultation-essentials-package',
                'consultation-deep-dive-package'
              )
          ) THEN
            RAISE EXCEPTION
              '0063_tier_per_service: unexpected consultation template row(s); '
              'whitelist tier slugs only';
          END IF;
        END $$;
        """
    )

    op.execute(
        """
        INSERT INTO services (
          id, service_type, title, service_key, booking_system, description,
          cover_image_s3_key, delivery_mode, status, created_by,
          service_tier, location_id
        )
        SELECT
          gen_random_uuid(),
          'consultation',
          CASE
            WHEN lower(t.slug) = 'consultation-essentials-package'
              THEN 'Family Consultation: Essentials'
            WHEN lower(t.slug) = 'consultation-deep-dive-package'
              THEN 'Family Consultation: Deep Dive'
          END,
          CASE
            WHEN lower(t.slug) = 'consultation-essentials-package'
              THEN 'family-consultation-essentials'
            WHEN lower(t.slug) = 'consultation-deep-dive-package'
              THEN 'family-consultation-deep-dive'
          END,
          parent.booking_system,
          COALESCE(t.description, parent.description),
          COALESCE(t.cover_image_s3_key, parent.cover_image_s3_key),
          COALESCE(t.delivery_mode, parent.delivery_mode),
          parent.status,
          'migration-0063',
          CASE
            WHEN lower(t.slug) = 'consultation-essentials-package' THEN 'essentials'
            WHEN lower(t.slug) = 'consultation-deep-dive-package' THEN 'deep_dive'
          END,
          COALESCE(t.location_id, parent.location_id)
        FROM service_instances t
        JOIN services parent ON parent.id = t.service_id
        WHERE t.is_template IS TRUE
          AND parent.service_type::text = 'consultation'
          AND lower(t.slug) IN (
            'consultation-essentials-package',
            'consultation-deep-dive-package'
          );
        """
    )

    op.execute(
        f"""
        INSERT INTO consultation_details (
          service_id,
          consultation_format,
          max_group_size,
          duration_minutes,
          pricing_model,
          default_hourly_rate,
          default_package_price,
          default_package_sessions,
          default_currency
        )
        SELECT
          ns.id,
          cd.consultation_format,
          cd.max_group_size,
          cd.duration_minutes,
          COALESCE(cid.pricing_model, cd.pricing_model),
          CASE
            WHEN COALESCE(cid.pricing_model, cd.pricing_model)::text = 'hourly'
              THEN COALESCE(cid.price, cd.default_hourly_rate)
            ELSE cd.default_hourly_rate
          END,
          CASE
            WHEN COALESCE(cid.pricing_model, cd.pricing_model)::text = 'package'
              THEN COALESCE(cid.price, cd.default_package_price)
            ELSE cd.default_package_price
          END,
          CASE
            WHEN COALESCE(cid.pricing_model, cd.pricing_model)::text = 'package'
              THEN COALESCE(cid.package_sessions, cd.default_package_sessions)
            ELSE cd.default_package_sessions
          END,
          cd.default_currency
        FROM service_instances tmpl
        JOIN services parent ON parent.id = tmpl.service_id
        JOIN services ns ON ns.service_key = {_TIER_SERVICE_KEY_CASE}
        JOIN consultation_details cd ON cd.service_id = parent.id
        LEFT JOIN consultation_instance_details cid ON cid.instance_id = tmpl.id
        WHERE tmpl.is_template IS TRUE
          AND parent.service_type::text = 'consultation'
          AND lower(tmpl.slug) IN (
            'consultation-essentials-package',
            'consultation-deep-dive-package'
          );
        """
    )

    op.execute(
        f"""
        UPDATE service_instances child
        SET service_id = new_svc.id,
            parent_instance_id = NULL
        FROM service_instances tmpl
        JOIN services new_svc ON new_svc.service_key = {_TIER_SERVICE_KEY_CASE}
        WHERE child.parent_instance_id = tmpl.id;
        """
    )

    op.execute(
        f"""
        UPDATE discount_codes dc
        SET service_id = new_svc.id,
            instance_id = NULL
        FROM service_instances tmpl
        JOIN services new_svc ON new_svc.service_key = {_TIER_SERVICE_KEY_CASE}
        WHERE dc.instance_id = tmpl.id
          AND tmpl.is_template IS TRUE;
        """
    )

    op.execute(
        f"""
        UPDATE service_instances si
        SET service_id = new_svc.id,
            is_template = FALSE
        FROM service_instances tmpl
        JOIN services new_svc ON new_svc.service_key = {_TIER_SERVICE_KEY_CASE}
        WHERE si.id = tmpl.id
          AND si.service_id = (
            SELECT id
            FROM services
            WHERE service_type::text = 'consultation'
              AND lower(trim(coalesce(service_key, ''))) = 'family-consultation'
            LIMIT 1
          );
        """
    )

    op.execute(
        """
        DO $$
        DECLARE
          legacy_id uuid;
        BEGIN
          SELECT id INTO legacy_id
          FROM services
          WHERE service_type::text = 'consultation'
            AND lower(trim(coalesce(service_key, ''))) = 'family-consultation'
          LIMIT 1;

          IF legacy_id IS NOT NULL THEN
            IF EXISTS (
              SELECT 1 FROM service_instances WHERE service_id = legacy_id
            ) THEN
              RAISE EXCEPTION
                '0063_tier_per_service: cannot delete legacy consultation service; '
                'instances still reference it';
            END IF;

            IF EXISTS (
              SELECT 1 FROM discount_codes WHERE service_id = legacy_id
            ) THEN
              RAISE EXCEPTION
                '0063_tier_per_service: cannot delete legacy consultation service; '
                'discount_codes still references it';
            END IF;

            DELETE FROM consultation_details WHERE service_id = legacy_id;

            DELETE FROM services WHERE id = legacy_id;
          END IF;
        END $$;
        """
    )

    op.execute(
        """
        UPDATE service_instances
        SET is_template = FALSE
        WHERE lower(slug) = 'intro-call-free-15min';
        """
    )

    op.add_column(
        "instance_session_slots",
        sa.Column("purpose_service_id", PG_UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE instance_session_slots iss
        SET purpose_service_id = si.service_id
        FROM service_instances si
        WHERE iss.instance_id = si.id
          AND iss.template_instance_id IS NOT NULL;
        """
    )
    op.execute(
        """
        UPDATE instance_session_slots iss
        SET purpose_service_id = s.id
        FROM service_instances si
        JOIN services s ON s.id = si.service_id
        WHERE iss.instance_id = si.id
          AND iss.template_instance_id IS NULL
          AND iss.purpose_service_id IS NULL
          AND s.service_type::text IN ('consultation', 'intro_call');
        """
    )
    op.create_foreign_key(
        "instance_session_slots_purpose_service_id_fkey",
        "instance_session_slots",
        "services",
        ["purpose_service_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        CREATE UNIQUE INDEX instance_session_slots_purpose_service_starts_uidx
        ON instance_session_slots (purpose_service_id, starts_at)
        WHERE purpose_service_id IS NOT NULL;
        """
    )
    op.execute("DROP INDEX IF EXISTS instance_session_slots_template_starts_uidx")
    op.drop_constraint(
        "instance_session_slots_template_instance_id_fkey",
        "instance_session_slots",
        type_="foreignkey",
    )
    op.drop_column("instance_session_slots", "template_instance_id")

    op.drop_constraint(
        "service_instances_template_consistency_chk",
        "service_instances",
        type_="check",
    )
    op.drop_constraint(
        "service_instances_parent_instance_id_fkey",
        "service_instances",
        type_="foreignkey",
    )
    op.drop_index("svc_instances_parent_idx", table_name="service_instances")
    op.drop_column("service_instances", "parent_instance_id")

    op.execute("DROP INDEX IF EXISTS svc_instances_slug_uq_template")
    op.execute("DROP INDEX IF EXISTS svc_instances_slug_uq_booking")
    op.execute(
        """
        CREATE UNIQUE INDEX svc_instances_slug_uq
        ON service_instances (slug);
        """
    )

    op.execute("DELETE FROM consultation_instance_details")
    op.drop_table("consultation_instance_details")

    op.drop_column("service_instances", "is_template")


def downgrade() -> None:
    """Best-effort DDL reversal toward ``0061``; data merge is intentionally lossy."""

    op.add_column(
        "service_instances",
        sa.Column(
            "is_template",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "consultation_instance_details",
        sa.Column(
            "instance_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "pricing_model",
            postgresql.ENUM(
                "free",
                "hourly",
                "package",
                name="consultation_pricing_model",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'HKD'"),
        ),
        sa.Column("package_sessions", sa.Integer(), nullable=True),
    )

    op.execute("DROP INDEX IF EXISTS svc_instances_slug_uq")
    op.execute(
        """
        CREATE UNIQUE INDEX svc_instances_slug_uq_template
        ON service_instances (slug)
        WHERE is_template IS TRUE;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX svc_instances_slug_uq_booking
        ON service_instances (slug)
        WHERE is_template IS FALSE;
        """
    )

    op.add_column(
        "service_instances",
        sa.Column("parent_instance_id", PG_UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "service_instances_parent_instance_id_fkey",
        "service_instances",
        "service_instances",
        ["parent_instance_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "svc_instances_parent_idx",
        "service_instances",
        ["parent_instance_id"],
    )
    op.create_check_constraint(
        "service_instances_template_consistency_chk",
        "service_instances",
        "(is_template IS TRUE AND parent_instance_id IS NULL) "
        "OR (is_template IS FALSE)",
    )

    op.add_column(
        "instance_session_slots",
        sa.Column("template_instance_id", PG_UUID(as_uuid=True), nullable=True),
    )

    op.execute(
        """
        INSERT INTO services (
          id, service_type, title, service_key, booking_system, description,
          cover_image_s3_key, delivery_mode, status, created_by,
          service_tier, location_id
        )
        SELECT * FROM (
          SELECT
            gen_random_uuid(),
            'consultation'::service_type,
            'Family Consultation',
            'family-consultation',
            src.booking_system,
            src.description,
            src.cover_image_s3_key,
            src.delivery_mode,
            src.status,
            'migration-0063-downgrade',
            NULL,
            src.location_id
          FROM services src
          WHERE lower(trim(coalesce(src.service_key, ''))) IN (
              'family-consultation-essentials',
              'family-consultation-deep-dive'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM services existing
              WHERE lower(trim(coalesce(existing.service_key, ''))) = 'family-consultation'
                AND existing.service_type::text = 'consultation'
            )
          ORDER BY src.created_at ASC
          LIMIT 1
        ) pick_one_row;
        """
    )

    op.execute(
        """
        INSERT INTO consultation_details (
          service_id,
          consultation_format,
          max_group_size,
          duration_minutes,
          pricing_model,
          default_hourly_rate,
          default_package_price,
          default_package_sessions,
          default_currency
        )
        SELECT
          ls.id,
          tier_cd.consultation_format,
          tier_cd.max_group_size,
          tier_cd.duration_minutes,
          tier_cd.pricing_model,
          tier_cd.default_hourly_rate,
          tier_cd.default_package_price,
          tier_cd.default_package_sessions,
          tier_cd.default_currency
        FROM services ls
        CROSS JOIN LATERAL (
          SELECT cd.*
          FROM consultation_details cd
          JOIN services tier ON tier.id = cd.service_id
          WHERE lower(trim(coalesce(tier.service_key, ''))) IN (
              'family-consultation-essentials',
              'family-consultation-deep-dive'
            )
          ORDER BY tier.created_at ASC
          LIMIT 1
        ) tier_cd
        WHERE lower(trim(coalesce(ls.service_key, ''))) = 'family-consultation'
          AND ls.service_type::text = 'consultation'
          AND NOT EXISTS (
            SELECT 1 FROM consultation_details x WHERE x.service_id = ls.id
          );
        """
    )

    op.execute(
        """
        UPDATE service_instances si
        SET service_id = ls.id,
            is_template = TRUE,
            parent_instance_id = NULL
        FROM services s
        JOIN services ls ON lower(trim(coalesce(ls.service_key, ''))) = 'family-consultation'
          AND ls.service_type::text = 'consultation'
        WHERE si.service_id = s.id
          AND lower(trim(coalesce(s.service_key, ''))) IN (
            'family-consultation-essentials',
            'family-consultation-deep-dive'
          )
          AND lower(si.slug) IN (
            'consultation-essentials-package',
            'consultation-deep-dive-package'
          );
        """
    )

    op.execute(
        """
        INSERT INTO consultation_instance_details (
          instance_id,
          pricing_model,
          price,
          currency,
          package_sessions
        )
        SELECT
          si.id,
          cd.pricing_model,
          CASE
            WHEN cd.pricing_model::text = 'hourly' THEN cd.default_hourly_rate
            WHEN cd.pricing_model::text = 'package' THEN cd.default_package_price
            ELSE NULL
          END,
          cd.default_currency,
          cd.default_package_sessions
        FROM service_instances si
        JOIN services s ON s.id = si.service_id
        JOIN consultation_details cd ON cd.service_id = s.id
        WHERE si.is_template IS TRUE
          AND lower(trim(coalesce(s.service_key, ''))) = 'family-consultation'
          AND lower(si.slug) IN (
            'consultation-essentials-package',
            'consultation-deep-dive-package'
          )
          AND NOT EXISTS (
            SELECT 1 FROM consultation_instance_details cid
            WHERE cid.instance_id = si.id
          );
        """
    )

    op.execute(
        """
        UPDATE service_instances si
        SET parent_instance_id = tmpl.id
        FROM service_instances tmpl
        JOIN services parent_svc ON parent_svc.id = tmpl.service_id
        WHERE si.parent_instance_id IS NULL
          AND si.is_template IS FALSE
          AND tmpl.is_template IS TRUE
          AND lower(trim(coalesce(parent_svc.service_key, ''))) = 'family-consultation'
          AND (
            (lower(tmpl.slug) = 'consultation-essentials-package'
              AND si.service_id IN (
                SELECT id FROM services
                WHERE lower(trim(coalesce(service_key, ''))) = 'family-consultation-essentials'
              ))
            OR
            (lower(tmpl.slug) = 'consultation-deep-dive-package'
              AND si.service_id IN (
                SELECT id FROM services
                WHERE lower(trim(coalesce(service_key, ''))) = 'family-consultation-deep-dive'
              ))
          );
        """
    )

    op.execute(
        """
        UPDATE service_instances si
        SET service_id = legacy.id
        FROM (
          SELECT id FROM services
          WHERE lower(trim(coalesce(service_key, ''))) = 'family-consultation'
            AND service_type::text = 'consultation'
          ORDER BY created_at ASC
          LIMIT 1
        ) AS legacy
        WHERE si.parent_instance_id IS NOT NULL
          AND si.is_template IS FALSE;
        """
    )

    op.execute(
        """
        UPDATE instance_session_slots iss
        SET template_instance_id = parent.id
        FROM service_instances child
        JOIN service_instances parent ON parent.id = child.parent_instance_id
        WHERE iss.instance_id = child.id
          AND child.parent_instance_id IS NOT NULL;
        """
    )

    op.execute(
        """
        UPDATE instance_session_slots iss
        SET template_instance_id = si.id
        FROM service_instances si
        JOIN services s ON s.id = si.service_id
        WHERE iss.instance_id = si.id
          AND iss.template_instance_id IS NULL
          AND s.service_type::text = 'intro_call';
        """
    )

    op.execute(
        "DROP INDEX IF EXISTS instance_session_slots_purpose_service_starts_uidx"
    )
    op.drop_constraint(
        "instance_session_slots_purpose_service_id_fkey",
        "instance_session_slots",
        type_="foreignkey",
    )
    op.drop_column("instance_session_slots", "purpose_service_id")

    op.create_foreign_key(
        "instance_session_slots_template_instance_id_fkey",
        "instance_session_slots",
        "service_instances",
        ["template_instance_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        CREATE UNIQUE INDEX instance_session_slots_template_starts_uidx
        ON instance_session_slots (template_instance_id, starts_at)
        WHERE template_instance_id IS NOT NULL;
        """
    )

    op.execute(
        """
        UPDATE service_instances
        SET is_template = TRUE
        WHERE lower(slug) = 'intro-call-free-15min';
        """
    )

    op.execute(
        """
        DELETE FROM consultation_details
        WHERE service_id IN (
          SELECT id FROM services
          WHERE lower(trim(coalesce(service_key, ''))) IN (
            'family-consultation-essentials',
            'family-consultation-deep-dive'
          )
        );
        """
    )

    op.execute(
        """
        DELETE FROM services
        WHERE lower(trim(coalesce(service_key, ''))) IN (
          'family-consultation-essentials',
          'family-consultation-deep-dive'
        );
        """
    )

    op.execute(
        """
        ALTER TABLE service_instances
        ALTER COLUMN is_template DROP DEFAULT;
        """
    )
