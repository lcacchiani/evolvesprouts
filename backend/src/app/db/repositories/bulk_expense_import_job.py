"""Repository for bulk expense import jobs."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.bulk_expense_import_job import (
    BulkExpenseImportJob,
    BulkExpenseImportJobStatus,
)
from app.db.repositories.base import BaseRepository


class BulkExpenseImportJobRepository(BaseRepository[BulkExpenseImportJob]):
    def __init__(self, session: Session):
        super().__init__(session, BulkExpenseImportJob)

    def get_for_actor(
        self, job_id: UUID, *, actor_sub: str
    ) -> BulkExpenseImportJob | None:
        stmt = select(BulkExpenseImportJob).where(
            BulkExpenseImportJob.id == job_id,
            BulkExpenseImportJob.created_by == actor_sub,
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def mark_processing(self, job: BulkExpenseImportJob) -> None:
        job.status = BulkExpenseImportJobStatus.PROCESSING
        job.updated_at = datetime.now(UTC)
        self.update(job)

    def mark_succeeded(
        self,
        job: BulkExpenseImportJob,
        *,
        expense_ids: list[UUID],
        created_count: int,
    ) -> None:
        job.status = BulkExpenseImportJobStatus.SUCCEEDED
        job.created_expense_ids = [str(eid) for eid in expense_ids]
        job.created_count = created_count
        job.error_message = None
        job.updated_at = datetime.now(UTC)
        self.update(job)

    def mark_failed(self, job: BulkExpenseImportJob, message: str) -> None:
        job.status = BulkExpenseImportJobStatus.FAILED
        job.error_message = message[:8000]
        job.updated_at = datetime.now(UTC)
        self.update(job)
