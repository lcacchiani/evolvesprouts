"""Add services, instances, enrollments, and discount codes.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into new service tables.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - New constrained fields are only on new tables and do not affect current seed.
3. Renamed/dropped columns reflected in seed data:
   - No columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - New tables are user-populated through admin workflows and do not require
     bootstrap rows.
5. Enum/allowed-value changes validated in seed rows:
   - New enums are additive and do not alter existing enum values.
6. FK/cascade changes validated for insert order and references:
   - New FKs reference existing tables and new tables created in dependency order.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0010_add_services"
down_revision: Union[str, None] = "0009_expand_crm_enums"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _service_enums() -> dict[str, postgresql.ENUM]:
    return {
        "service_type": postgresql.ENUM(
            "training_course",
            "event",
            "consultation",
            name="service_type",
            create_type=False,
        ),
        "service_status": postgresql.ENUM(
            "draft",
            "published",
            "archived",
            name="service_status",
            create_type=False,
        ),
        "service_delivery_mode": postgresql.ENUM(
            "online",
            "in_person",
            "hybrid",
            name="service_delivery_mode",
            create_type=False,
        ),
        "training_format": postgresql.ENUM(
            "group",
            "private",
            name="training_format",
            create_type=False,
        ),
        "training_pricing_unit": postgresql.ENUM(
            "per_person",
            "per_family",
            name="training_pricing_unit",
            create_type=False,
        ),
        "event_category": postgresql.ENUM(
            "workshop",
            "webinar",
            "open_house",
            "community_meetup",
            "other",
            name="event_category",
            create_type=False,
        ),
        "consultation_format": postgresql.ENUM(
            "one_on_one",
            "group",
            name="consultation_format",
            create_type=False,
        ),
        "consultation_pricing_model": postgresql.ENUM(
            "free",
            "hourly",
            "package",
            name="consultation_pricing_model",
            create_type=False,
        ),
        "instance_status": postgresql.ENUM(
            "scheduled",
            "open",
            "full",
            "in_progress",
            "completed",
            "cancelled",
            name="instance_status",
            create_type=False,
        ),
        "discount_type": postgresql.ENUM(
            "percentage",
            "absolute",
            name="discount_type",
            create_type=False,
        ),
        "enrollment_status": postgresql.ENUM(
            "registered",
            "waitlisted",
            "confirmed",
            "cancelled",
            "completed",
            name="enrollment_status",
            create_type=False,
        ),
    }


def upgrade() -> None:
    """Create service schema objects."""
    bind = op.get_bind()
    enums = _service_enums()
    for enum_obj in enums.values():
        enum_obj.create(bind, checkfirst=True)

    op.create_table(
        "services",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("service_type", enums["service_type"], nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image_s3_key", sa.String(), nullable=True),
        sa.Column("delivery_mode", enums["service_delivery_mode"], nullable=False),
        sa.Column(
            "status",
            enums["service_status"],
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("services_type_idx", "services", ["service_type"])
    op.create_index("services_status_idx", "services", ["status"])
    op.execute(
        """
        CREATE TRIGGER services_set_updated_at
        BEFORE UPDATE ON services
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "training_course_details",
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "pricing_unit",
            enums["training_pricing_unit"],
            nullable=False,
            server_default=sa.text("'per_person'"),
        ),
        sa.Column("default_price", sa.Numeric(10, 2), nullable=True),
        sa.Column(
            "default_currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'HKD'"),
        ),
    )

    op.create_table(
        "event_details",
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("event_category", enums["event_category"], nullable=False),
    )

    op.create_table(
        "consultation_details",
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("consultation_format", enums["consultation_format"], nullable=False),
        sa.Column("max_group_size", sa.Integer(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("pricing_model", enums["consultation_pricing_model"], nullable=False),
        sa.Column("default_hourly_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("default_package_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("default_package_sessions", sa.Integer(), nullable=True),
        sa.Column(
            "default_currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'HKD'"),
        ),
        sa.Column("calendly_url", sa.String(500), nullable=True),
    )

    op.create_table(
        "service_instances",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image_s3_key", sa.String(), nullable=True),
        sa.Column(
            "status",
            enums["instance_status"],
            nullable=False,
            server_default=sa.text("'scheduled'"),
        ),
        sa.Column("delivery_mode", enums["service_delivery_mode"], nullable=True),
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("max_capacity", sa.Integer(), nullable=True),
        sa.Column(
            "waitlist_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("instructor_id", sa.String(128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "max_capacity IS NULL OR max_capacity > 0",
            name="service_instances_capacity_positive",
        ),
    )
    op.create_index("svc_instances_service_idx", "service_instances", ["service_id"])
    op.create_index("svc_instances_status_idx", "service_instances", ["status"])
    op.create_index(
        "svc_instances_instructor_idx",
        "service_instances",
        ["instructor_id"],
    )
    op.execute(
        """
        CREATE TRIGGER service_instances_set_updated_at
        BEFORE UPDATE ON service_instances
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "instance_session_slots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("starts_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ends_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "ends_at > starts_at",
            name="instance_session_slots_valid_range",
        ),
    )
    op.create_index(
        "session_slots_instance_idx",
        "instance_session_slots",
        ["instance_id"],
    )

    op.create_table(
        "training_instance_details",
        sa.Column(
            "instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("training_format", enums["training_format"], nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'HKD'"),
        ),
        sa.Column(
            "pricing_unit",
            enums["training_pricing_unit"],
            nullable=False,
            server_default=sa.text("'per_person'"),
        ),
    )

    op.create_table(
        "event_ticket_tiers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'HKD'"),
        ),
        sa.Column("max_quantity", sa.Integer(), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ticket_tiers_instance_idx", "event_ticket_tiers", ["instance_id"])

    op.create_table(
        "consultation_instance_details",
        sa.Column(
            "instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "pricing_model",
            enums["consultation_pricing_model"],
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
        sa.Column("calendly_event_url", sa.String(500), nullable=True),
    )

    op.create_table(
        "discount_codes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("discount_type", enums["discount_type"], nullable=False),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("valid_from", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("valid_until", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column(
            "current_uses",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "discount_value > 0",
            name="discount_codes_positive_value",
        ),
    )
    op.create_index(
        "discount_codes_code_unique_idx",
        "discount_codes",
        [sa.text("lower(code)")],
        unique=True,
    )
    op.create_index("discount_codes_service_idx", "discount_codes", ["service_id"])
    op.create_index("discount_codes_instance_idx", "discount_codes", ["instance_id"])
    op.execute(
        """
        CREATE TRIGGER discount_codes_set_updated_at
        BEFORE UPDATE ON discount_codes
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "enrollments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "instance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "family_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("families.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "ticket_tier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_ticket_tiers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "discount_code_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("discount_codes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            enums["enrollment_status"],
            nullable=False,
            server_default=sa.text("'registered'"),
        ),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column(
            "enrolled_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("cancelled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "contact_id IS NOT NULL OR family_id IS NOT NULL OR organization_id IS NOT NULL",
            name="enrollments_has_parent",
        ),
    )
    op.create_index("enrollments_instance_idx", "enrollments", ["instance_id"])
    op.create_index("enrollments_contact_idx", "enrollments", ["contact_id"])
    op.create_index("enrollments_family_idx", "enrollments", ["family_id"])
    op.create_index("enrollments_org_idx", "enrollments", ["organization_id"])
    op.create_index("enrollments_status_idx", "enrollments", ["status"])
    op.execute(
        """
        CREATE TRIGGER enrollments_set_updated_at
        BEFORE UPDATE ON enrollments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "service_tags",
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "service_assets",
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    """Drop service schema objects."""
    bind = op.get_bind()
    enums = _service_enums()

    op.execute("DROP TRIGGER IF EXISTS enrollments_set_updated_at ON enrollments")
    op.execute("DROP TRIGGER IF EXISTS discount_codes_set_updated_at ON discount_codes")
    op.execute(
        "DROP TRIGGER IF EXISTS service_instances_set_updated_at ON service_instances"
    )
    op.execute("DROP TRIGGER IF EXISTS services_set_updated_at ON services")

    op.drop_table("service_assets")
    op.drop_table("service_tags")

    op.drop_index("enrollments_status_idx", table_name="enrollments")
    op.drop_index("enrollments_org_idx", table_name="enrollments")
    op.drop_index("enrollments_family_idx", table_name="enrollments")
    op.drop_index("enrollments_contact_idx", table_name="enrollments")
    op.drop_index("enrollments_instance_idx", table_name="enrollments")
    op.drop_table("enrollments")

    op.drop_index("discount_codes_instance_idx", table_name="discount_codes")
    op.drop_index("discount_codes_service_idx", table_name="discount_codes")
    op.drop_index("discount_codes_code_unique_idx", table_name="discount_codes")
    op.drop_table("discount_codes")

    op.drop_table("consultation_instance_details")

    op.drop_index("ticket_tiers_instance_idx", table_name="event_ticket_tiers")
    op.drop_table("event_ticket_tiers")

    op.drop_table("training_instance_details")

    op.drop_index("session_slots_instance_idx", table_name="instance_session_slots")
    op.drop_table("instance_session_slots")

    op.drop_index("svc_instances_instructor_idx", table_name="service_instances")
    op.drop_index("svc_instances_status_idx", table_name="service_instances")
    op.drop_index("svc_instances_service_idx", table_name="service_instances")
    op.drop_table("service_instances")

    op.drop_table("consultation_details")
    op.drop_table("event_details")
    op.drop_table("training_course_details")

    op.drop_index("services_status_idx", table_name="services")
    op.drop_index("services_type_idx", table_name="services")
    op.drop_table("services")

    for enum_obj in reversed(list(enums.values())):
        enum_obj.drop(bind, checkfirst=True)
