"""Repository for expense entities."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.db.models import Expense, ExpenseAttachment, ExpenseParseStatus, ExpenseStatus
from app.db.models import Organization
from app.db.models.enums import RelationshipType
from app.db.repositories.base import BaseRepository
from app.services.asset_expense_tagging import sync_expense_attachment_tags_for_assets


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters."""
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ExpenseRepository(BaseRepository[Expense]):
    """Repository for Expense CRUD and related attachment operations."""

    def __init__(self, session: Session):
        super().__init__(session, Expense)

    def list_expenses(
        self,
        *,
        limit: int = 50,
        cursor: UUID | None = None,
        query: str | None = None,
        status: ExpenseStatus | None = None,
        parse_status: ExpenseParseStatus | None = None,
    ) -> Sequence[Expense]:
        """List expenses with optional filters and cursor pagination."""
        vendor_org = aliased(Organization)
        statement = (
            select(Expense)
            .outerjoin(vendor_org, Expense.vendor_id == vendor_org.id)
            .options(
                selectinload(Expense.attachments).selectinload(ExpenseAttachment.asset),
                selectinload(Expense.vendor),
            )
            .order_by(Expense.created_at.desc(), Expense.id.desc())
        )
        if cursor is not None:
            cursor_created_at = (
                select(Expense.created_at).where(Expense.id == cursor).scalar_subquery()
            )
            statement = statement.where(
                or_(
                    Expense.created_at < cursor_created_at,
                    and_(Expense.created_at == cursor_created_at, Expense.id < cursor),
                )
            )
        if status is not None:
            statement = statement.where(Expense.status == status)
        if parse_status is not None:
            statement = statement.where(Expense.parse_status == parse_status)
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    and_(
                        vendor_org.relationship_type == RelationshipType.VENDOR,
                        vendor_org.name.ilike(pattern, escape="\\"),
                    ),
                    Expense.invoice_number.ilike(pattern, escape="\\"),
                )
            )
        statement = statement.limit(limit)
        return self._session.execute(statement).scalars().all()

    def count_expenses(
        self,
        *,
        query: str | None = None,
        status: ExpenseStatus | None = None,
        parse_status: ExpenseParseStatus | None = None,
    ) -> int:
        """Count expenses with matching filters."""
        vendor_org = aliased(Organization)
        statement = (
            select(func.count())
            .select_from(Expense)
            .outerjoin(vendor_org, Expense.vendor_id == vendor_org.id)
        )
        if status is not None:
            statement = statement.where(Expense.status == status)
        if parse_status is not None:
            statement = statement.where(Expense.parse_status == parse_status)
        if query:
            escaped = _escape_like_pattern(query.strip())
            pattern = f"%{escaped}%"
            statement = statement.where(
                or_(
                    and_(
                        vendor_org.relationship_type == RelationshipType.VENDOR,
                        vendor_org.name.ilike(pattern, escape="\\"),
                    ),
                    Expense.invoice_number.ilike(pattern, escape="\\"),
                )
            )
        return self._session.execute(statement).scalar_one()

    def get_with_attachments(self, expense_id: UUID) -> Expense | None:
        """Get an expense with attachment and asset details."""
        statement = (
            select(Expense)
            .options(
                selectinload(Expense.attachments).selectinload(ExpenseAttachment.asset),
                selectinload(Expense.vendor),
            )
            .where(Expense.id == expense_id)
        )
        return self._session.execute(statement).scalar_one_or_none()

    def create_expense(
        self,
        *,
        created_by: str,
        status: ExpenseStatus,
        parse_status: ExpenseParseStatus,
        amends_expense_id: UUID | None = None,
        vendor_id: UUID | None = None,
        invoice_number: str | None = None,
        invoice_date: date | None = None,
        due_date: date | None = None,
        currency: str | None = None,
        subtotal: Decimal | None = None,
        tax: Decimal | None = None,
        total: Decimal | None = None,
        line_items: list[dict[str, object]] | None = None,
        notes: str | None = None,
    ) -> Expense:
        """Create and persist an expense row."""
        entity = Expense(
            created_by=created_by,
            status=status,
            parse_status=parse_status,
            amends_expense_id=amends_expense_id,
            vendor_id=vendor_id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            due_date=due_date,
            currency=currency,
            subtotal=subtotal,
            tax=tax,
            total=total,
            line_items=line_items,
            notes=notes,
        )
        return self.create(entity)

    def replace_attachments(self, expense: Expense, asset_ids: list[UUID]) -> Expense:
        """Replace expense attachments with the provided asset IDs."""
        previous_ids = {row.asset_id for row in expense.attachments}
        # Flush deletes before inserting replacements. A single flush can otherwise
        # INSERT new (expense_id, asset_id) rows while old rows still exist, hitting
        # expense_attachments_unique_idx (seen on PATCH /v1/admin/expenses/{id}).
        expense.attachments.clear()
        self._session.flush()
        expense.attachments.extend(
            ExpenseAttachment(asset_id=asset_id, sort_order=index)
            for index, asset_id in enumerate(asset_ids)
        )
        updated = self.update(expense)
        self._session.flush()
        sync_expense_attachment_tags_for_assets(
            self._session, previous_ids | set(asset_ids)
        )
        return updated
