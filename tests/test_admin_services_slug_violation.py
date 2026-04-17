from __future__ import annotations

from typing import Any

from sqlalchemy.exc import IntegrityError

from app.api.admin_services import _is_services_slug_unique_violation


def _make_integrity_error(*, constraint_name: str | None, message: str) -> IntegrityError:
    class _Diag:
        def __init__(self, name: str | None) -> None:
            self.constraint_name = name

    class _Orig:
        def __init__(self, name: str | None) -> None:
            self.diag = _Diag(name)

    orig = _Orig(constraint_name)
    return IntegrityError(message, None, orig)


def test_slug_violation_true_when_constraint_name_matches() -> None:
    exc = _make_integrity_error(
        constraint_name="services_slug_unique_idx",
        message="duplicate key",
    )
    assert _is_services_slug_unique_violation(exc) is True


def test_slug_violation_false_for_other_unique_constraint() -> None:
    exc = _make_integrity_error(
        constraint_name="svc_instances_slug_uq",
        message="duplicate key value violates unique constraint svc_instances_slug_uq",
    )
    assert _is_services_slug_unique_violation(exc) is False


def test_slug_violation_message_fallback_rejects_instance_slug_constraint() -> None:
    exc_instance = _make_integrity_error(
        constraint_name=None,
        message='duplicate key value violates unique constraint "svc_instances_slug_uq"',
    )
    assert _is_services_slug_unique_violation(exc_instance) is False

    exc_ok = _make_integrity_error(
        constraint_name=None,
        message='duplicate key value violates unique constraint "services_slug_unique_idx"',
    )
    assert _is_services_slug_unique_violation(exc_ok) is True
