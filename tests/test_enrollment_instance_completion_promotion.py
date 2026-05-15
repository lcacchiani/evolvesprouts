"""Unit tests for bulk enrollment completion when a service instance completes."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy.sql.dml import Update

from app.db.repositories.enrollment import EnrollmentRepository


def test_mark_registered_or_confirmed_enrollments_completed_issues_update() -> None:
    captured: list[object] = []

    class _FakeSession:
        def execute(self, stmt: object) -> object:
            captured.append(stmt)

            class _Result:
                rowcount = 0

            return _Result()

    repo = EnrollmentRepository(_FakeSession())  # type: ignore[arg-type]
    instance_id = uuid4()
    repo.mark_registered_or_confirmed_enrollments_completed(instance_id)
    assert len(captured) == 1
    assert isinstance(captured[0], Update)
