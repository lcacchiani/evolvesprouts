"""Add CRM schema tables for media lead capture.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` currently contains no inserts for
     `assets`, `locations`, or CRM tables introduced by this migration.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - New constrained columns are introduced only in new tables and do not
     impact existing seed statements.
3. Renamed/dropped columns reflected in seed data:
   - No existing columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - New CRM tables do not require mandatory bootstrap rows.
5. Enum/allowed-value changes validated in seed rows:
   - Existing enums are unchanged; only new enums are introduced.
6. FK/cascade changes validated for insert order and references:
   - New FKs reference existing `assets` tables plus new CRM tables created in
     dependency order.
   - `locations` FKs are created only when a `locations` table already exists
     in the target database, to preserve compatibility for fresh deployments
     where location tables are not yet present in this migration chain.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0007_add_crm_tables"
down_revision: Union[str, None] = "0006_drop_share_domain_default"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create CRM enums, tables, indexes, and update triggers."""
    bind = op.get_bind()
    locations_table_exists = sa.inspect(bind).has_table("locations")

    contact_type_enum = postgresql.ENUM(
        "parent",
        "child",
        "helper",
        "professional",
        "other",
        name="contact_type",
        create_type=False,
    )
    contact_source_enum = postgresql.ENUM(
        "free_guide",
        "newsletter",
        "contact_form",
        "reservation",
        "referral",
        "instagram",
        "manual",
        name="contact_source",
        create_type=False,
    )
    relationship_type_enum = postgresql.ENUM(
        "prospect",
        "client",
        "past_client",
        "partner",
        "vendor",
        "other",
        name="relationship_type",
        create_type=False,
    )
    mailchimp_sync_status_enum = postgresql.ENUM(
        "pending",
        "synced",
        "failed",
        "unsubscribed",
        name="mailchimp_sync_status",
        create_type=False,
    )
    family_role_enum = postgresql.ENUM(
        "parent",
        "child",
        "helper",
        "guardian",
        "other",
        name="family_role",
        create_type=False,
    )
    organization_type_enum = postgresql.ENUM(
        "school",
        "company",
        "community_group",
        "ngo",
        "other",
        name="organization_type",
        create_type=False,
    )
    organization_role_enum = postgresql.ENUM(
        "admin",
        "staff",
        "teacher",
        "member",
        "client",
        "partner",
        "other",
        name="organization_role",
        create_type=False,
    )
    lead_type_enum = postgresql.ENUM(
        "free_guide",
        "event_inquiry",
        "program_enrollment",
        "consultation",
        "partnership",
        "other",
        name="lead_type",
        create_type=False,
    )
    funnel_stage_enum = postgresql.ENUM(
        "new",
        "contacted",
        "engaged",
        "qualified",
        "converted",
        "lost",
        name="funnel_stage",
        create_type=False,
    )
    lead_event_type_enum = postgresql.ENUM(
        "created",
        "stage_changed",
        "note_added",
        "email_sent",
        "email_opened",
        "guide_downloaded",
        "assigned",
        "converted",
        "lost",
        name="lead_event_type",
        create_type=False,
    )

    contact_type_enum.create(bind, checkfirst=True)
    contact_source_enum.create(bind, checkfirst=True)
    relationship_type_enum.create(bind, checkfirst=True)
    mailchimp_sync_status_enum.create(bind, checkfirst=True)
    family_role_enum.create(bind, checkfirst=True)
    organization_type_enum.create(bind, checkfirst=True)
    organization_role_enum.create(bind, checkfirst=True)
    lead_type_enum.create(bind, checkfirst=True)
    funnel_stage_enum.create(bind, checkfirst=True)
    lead_event_type_enum.create(bind, checkfirst=True)

    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    contact_location_column = (
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        )
        if locations_table_exists
        else sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        )
    )
    family_location_column = (
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        )
        if locations_table_exists
        else sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        )
    )
    organization_location_column = (
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        )
        if locations_table_exists
        else sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        )
    )

    op.create_table(
        "contacts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("instagram_handle", sa.String(30), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("contact_type", contact_type_enum, nullable=False),
        sa.Column(
            "relationship_type",
            relationship_type_enum,
            nullable=False,
            server_default=sa.text("'prospect'"),
        ),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        contact_location_column,
        sa.Column("source", contact_source_enum, nullable=False),
        sa.Column("source_detail", sa.Text(), nullable=True),
        sa.Column("source_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("mailchimp_subscriber_id", sa.String(64), nullable=True),
        sa.Column(
            "mailchimp_status",
            mailchimp_sync_status_enum,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
    op.create_index(
        "contacts_email_unique_idx",
        "contacts",
        [sa.text("lower(email)")],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )
    op.create_index(
        "contacts_instagram_unique_idx",
        "contacts",
        [sa.text("lower(instagram_handle)")],
        unique=True,
        postgresql_where=sa.text("instagram_handle IS NOT NULL"),
    )
    op.create_index("contacts_contact_type_idx", "contacts", ["contact_type"])
    op.create_index(
        "contacts_relationship_type_idx",
        "contacts",
        ["relationship_type"],
    )
    op.create_index("contacts_source_idx", "contacts", ["source"])
    op.create_index(
        "contacts_archived_at_idx",
        "contacts",
        ["archived_at"],
        postgresql_where=sa.text("archived_at IS NULL"),
    )
    op.execute(
        """
        CREATE TRIGGER contacts_set_updated_at
        BEFORE UPDATE ON contacts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "families",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("family_name", sa.String(150), nullable=False),
        sa.Column(
            "relationship_type",
            relationship_type_enum,
            nullable=False,
            server_default=sa.text("'prospect'"),
        ),
        family_location_column,
        sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
    op.create_index("families_relationship_type_idx", "families", ["relationship_type"])
    op.execute(
        """
        CREATE TRIGGER families_set_updated_at
        BEFORE UPDATE ON families
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "organizations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("organization_type", organization_type_enum, nullable=False),
        sa.Column(
            "relationship_type",
            relationship_type_enum,
            nullable=False,
            server_default=sa.text("'prospect'"),
        ),
        sa.Column("website", sa.String(500), nullable=True),
        organization_location_column,
        sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
    op.create_index("organizations_type_idx", "organizations", ["organization_type"])
    op.create_index(
        "organizations_relationship_type_idx",
        "organizations",
        ["relationship_type"],
    )
    op.execute(
        """
        CREATE TRIGGER organizations_set_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "family_members",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "family_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("families.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", family_role_enum, nullable=False),
        sa.Column(
            "is_primary_contact",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("family_id", "contact_id"),
    )
    op.create_index("family_members_contact_idx", "family_members", ["contact_id"])

    op.create_table(
        "organization_members",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", organization_role_enum, nullable=False),
        sa.Column("title", sa.String(150), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("organization_id", "contact_id"),
    )
    op.create_index(
        "organization_members_contact_idx",
        "organization_members",
        ["contact_id"],
    )

    op.create_table(
        "tags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "tags_name_unique_idx",
        "tags",
        [sa.text("lower(name)")],
        unique=True,
    )

    op.create_table(
        "contact_tags",
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
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
        "family_tags",
        sa.Column(
            "family_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("families.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
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
        "organization_tags",
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
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
        "sales_leads",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
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
        sa.Column("lead_type", lead_type_enum, nullable=False),
        sa.Column(
            "funnel_stage",
            funnel_stage_enum,
            nullable=False,
            server_default=sa.text("'new'"),
        ),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("assigned_to", sa.String(128), nullable=True),
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
        sa.Column("converted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("lost_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("lost_reason", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "contact_id IS NOT NULL OR family_id IS NOT NULL OR organization_id IS NOT NULL",
            name="sales_leads_has_parent",
        ),
    )
    op.create_index("sales_leads_contact_idx", "sales_leads", ["contact_id"])
    op.create_index("sales_leads_family_idx", "sales_leads", ["family_id"])
    op.create_index("sales_leads_org_idx", "sales_leads", ["organization_id"])
    op.create_index("sales_leads_funnel_stage_idx", "sales_leads", ["funnel_stage"])
    op.create_index(
        "sales_leads_guide_dedup_idx",
        "sales_leads",
        ["contact_id", "lead_type", "asset_id"],
        unique=True,
        postgresql_where=sa.text("asset_id IS NOT NULL"),
    )
    op.execute(
        """
        CREATE TRIGGER sales_leads_set_updated_at
        BEFORE UPDATE ON sales_leads
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "crm_notes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
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
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sales_leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
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
            (
                "contact_id IS NOT NULL OR family_id IS NOT NULL OR "
                "organization_id IS NOT NULL OR lead_id IS NOT NULL"
            ),
            name="crm_notes_has_parent",
        ),
    )
    op.create_index("crm_notes_contact_idx", "crm_notes", ["contact_id", "created_at"])
    op.create_index("crm_notes_family_idx", "crm_notes", ["family_id", "created_at"])
    op.create_index("crm_notes_lead_idx", "crm_notes", ["lead_id", "created_at"])
    op.execute(
        """
        CREATE TRIGGER crm_notes_set_updated_at
        BEFORE UPDATE ON crm_notes
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "sales_lead_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sales_leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", lead_event_type_enum, nullable=False),
        sa.Column("from_stage", funnel_stage_enum, nullable=True),
        sa.Column("to_stage", funnel_stage_enum, nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_by", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "sales_lead_events_lead_idx",
        "sales_lead_events",
        ["lead_id", "created_at"],
    )


def downgrade() -> None:
    """Drop CRM schema tables, triggers, function, and enums."""
    bind = op.get_bind()

    op.execute("DROP TRIGGER IF EXISTS crm_notes_set_updated_at ON crm_notes")
    op.execute("DROP TRIGGER IF EXISTS sales_leads_set_updated_at ON sales_leads")
    op.execute("DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations")
    op.execute("DROP TRIGGER IF EXISTS families_set_updated_at ON families")
    op.execute("DROP TRIGGER IF EXISTS contacts_set_updated_at ON contacts")

    op.drop_index("sales_lead_events_lead_idx", table_name="sales_lead_events")
    op.drop_table("sales_lead_events")

    op.drop_index("crm_notes_lead_idx", table_name="crm_notes")
    op.drop_index("crm_notes_family_idx", table_name="crm_notes")
    op.drop_index("crm_notes_contact_idx", table_name="crm_notes")
    op.drop_table("crm_notes")

    op.drop_index("sales_leads_guide_dedup_idx", table_name="sales_leads")
    op.drop_index("sales_leads_funnel_stage_idx", table_name="sales_leads")
    op.drop_index("sales_leads_org_idx", table_name="sales_leads")
    op.drop_index("sales_leads_family_idx", table_name="sales_leads")
    op.drop_index("sales_leads_contact_idx", table_name="sales_leads")
    op.drop_table("sales_leads")

    op.drop_table("organization_tags")
    op.drop_table("family_tags")
    op.drop_table("contact_tags")

    op.drop_index("tags_name_unique_idx", table_name="tags")
    op.drop_table("tags")

    op.drop_index("organization_members_contact_idx", table_name="organization_members")
    op.drop_table("organization_members")

    op.drop_index("family_members_contact_idx", table_name="family_members")
    op.drop_table("family_members")

    op.drop_index("organizations_relationship_type_idx", table_name="organizations")
    op.drop_index("organizations_type_idx", table_name="organizations")
    op.drop_table("organizations")

    op.drop_index("families_relationship_type_idx", table_name="families")
    op.drop_table("families")

    op.drop_index("contacts_archived_at_idx", table_name="contacts")
    op.drop_index("contacts_source_idx", table_name="contacts")
    op.drop_index("contacts_relationship_type_idx", table_name="contacts")
    op.drop_index("contacts_contact_type_idx", table_name="contacts")
    op.drop_index("contacts_instagram_unique_idx", table_name="contacts")
    op.drop_index("contacts_email_unique_idx", table_name="contacts")
    op.drop_table("contacts")

    op.execute("DROP FUNCTION IF EXISTS set_updated_at")

    lead_event_type_enum = postgresql.ENUM(
        "created",
        "stage_changed",
        "note_added",
        "email_sent",
        "email_opened",
        "guide_downloaded",
        "assigned",
        "converted",
        "lost",
        name="lead_event_type",
        create_type=False,
    )
    funnel_stage_enum = postgresql.ENUM(
        "new",
        "contacted",
        "engaged",
        "qualified",
        "converted",
        "lost",
        name="funnel_stage",
        create_type=False,
    )
    lead_type_enum = postgresql.ENUM(
        "free_guide",
        "event_inquiry",
        "program_enrollment",
        "consultation",
        "partnership",
        "other",
        name="lead_type",
        create_type=False,
    )
    organization_role_enum = postgresql.ENUM(
        "admin",
        "staff",
        "teacher",
        "member",
        "client",
        "partner",
        "other",
        name="organization_role",
        create_type=False,
    )
    organization_type_enum = postgresql.ENUM(
        "school",
        "company",
        "community_group",
        "ngo",
        "other",
        name="organization_type",
        create_type=False,
    )
    family_role_enum = postgresql.ENUM(
        "parent",
        "child",
        "helper",
        "guardian",
        "other",
        name="family_role",
        create_type=False,
    )
    mailchimp_sync_status_enum = postgresql.ENUM(
        "pending",
        "synced",
        "failed",
        "unsubscribed",
        name="mailchimp_sync_status",
        create_type=False,
    )
    relationship_type_enum = postgresql.ENUM(
        "prospect",
        "client",
        "past_client",
        "partner",
        "vendor",
        "other",
        name="relationship_type",
        create_type=False,
    )
    contact_source_enum = postgresql.ENUM(
        "free_guide",
        "newsletter",
        "contact_form",
        "reservation",
        "referral",
        "instagram",
        "manual",
        name="contact_source",
        create_type=False,
    )
    contact_type_enum = postgresql.ENUM(
        "parent",
        "child",
        "helper",
        "professional",
        "other",
        name="contact_type",
        create_type=False,
    )

    lead_event_type_enum.drop(bind, checkfirst=True)
    funnel_stage_enum.drop(bind, checkfirst=True)
    lead_type_enum.drop(bind, checkfirst=True)
    organization_role_enum.drop(bind, checkfirst=True)
    organization_type_enum.drop(bind, checkfirst=True)
    family_role_enum.drop(bind, checkfirst=True)
    mailchimp_sync_status_enum.drop(bind, checkfirst=True)
    relationship_type_enum.drop(bind, checkfirst=True)
    contact_source_enum.drop(bind, checkfirst=True)
    contact_type_enum.drop(bind, checkfirst=True)
