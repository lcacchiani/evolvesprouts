"""Native discount code validation for public booking (Aurora-backed)."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_string_length
from app.currency_config import currency_symbol_for_iso_code
from app.db.engine import get_engine
from app.db.models import DiscountCode
from app.db.models.enums import DiscountType
from app.db.repositories import DiscountCodeRepository, ServiceRepository
from app.db.repositories.service_instance import ServiceInstanceRepository
from app.utils import json_response
from app.utils.logging import get_logger, hash_for_correlation, mask_pii
from app.utils.public_slug import PUBLIC_INSTANCE_SLUG_PATTERN

logger = get_logger(__name__)

# Logged on 404 responses only; stable for CloudWatch Insights. Never log raw codes.
_REJECTION_UNKNOWN_SERVICE_KEY = "unknown_service_key"
_REJECTION_CODE_NOT_FOUND = "code_not_found"
_REJECTION_REFERRAL_TYPE = "referral_type_not_allowed"
_REJECTION_INACTIVE = "inactive"
_REJECTION_NOT_YET_VALID = "not_yet_valid"
_REJECTION_EXPIRED = "expired"
_REJECTION_MAX_USES = "max_uses_exhausted"
_REJECTION_INSTANCE_ID_REQUIRED = "instance_id_required"
_REJECTION_INSTANCE_SCOPE_MISMATCH = "instance_scope_mismatch"
_REJECTION_UNKNOWN_INSTANCE_SLUG = "unknown_instance_slug"
_REJECTION_SERVICE_SCOPE_MISMATCH = "service_scope_mismatch"

_MAX_CODE_LENGTH = 100
_MAX_SERVICE_KEY_LENGTH = 120
_MAX_SERVICE_INSTANCE_SLUG_LENGTH = 128


def _log_discount_validate_rejection(
    reason: str,
    *,
    code: str,
    extra: dict[str, Any] | None = None,
) -> None:
    """Log why validation returned 404 without exposing the full discount code."""
    payload: dict[str, Any] = {
        "rejection_reason": reason,
        "code_hash": hash_for_correlation(code.strip().lower()),
        "code_prefix": mask_pii(code.strip().upper(), visible_chars=2),
    }
    if extra:
        payload.update(extra)
    logger.info("Public discount validate rejected", extra=payload)


def handle_public_discount_validate(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Validate a discount code; response shape matches the public booking contract."""
    logger.info(
        "Handling public discount validate request",
        extra={"method": method},
    )
    if method != "POST":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    body = parse_body(event)
    code = validate_string_length(
        body.get("code"),
        "code",
        _MAX_CODE_LENGTH,
        required=True,
    )
    if code is None:
        return json_response(400, {"error": "code is required"}, event=event)

    service_key = validate_string_length(
        body.get("service_key"),
        "service_key",
        _MAX_SERVICE_KEY_LENGTH,
        required=False,
    )
    service_instance_slug_raw = validate_string_length(
        body.get("service_instance_slug"),
        "service_instance_slug",
        _MAX_SERVICE_INSTANCE_SLUG_LENGTH,
        required=False,
    )
    service_instance_slug_normalized = (
        service_instance_slug_raw.strip().lower()
        if service_instance_slug_raw and service_instance_slug_raw.strip()
        else ""
    )
    if service_instance_slug_normalized and not PUBLIC_INSTANCE_SLUG_PATTERN.fullmatch(
        service_instance_slug_normalized
    ):
        return json_response(
            400,
            {
                "error": "service_instance_slug must match the public slug pattern",
                "field": "service_instance_slug",
            },
            event=event,
        )

    logger.info(
        "Validating discount code",
        extra={"code": mask_pii(code.strip().upper(), visible_chars=2)},
    )

    service_key_normalized = (
        service_key.strip() if service_key and service_key.strip() else ""
    )
    # Slug resolution is deferred until after we load the code row so unscoped
    # ("all services") codes are not rejected when the page sends a stale or
    # placeholder `service_key` that does not match `services.slug`.
    resolved_service_id: UUID | None = None

    with Session(get_engine()) as session:
        repository = DiscountCodeRepository(session)
        row = repository.get_by_code(code)
        if row is None:
            _log_discount_validate_rejection(
                _REJECTION_CODE_NOT_FOUND,
                code=code,
            )
            return json_response(
                404,
                {"error": "Discount code not found or inactive"},
                event=event,
            )

        if row.discount_type == DiscountType.REFERRAL:
            _log_discount_validate_rejection(
                _REJECTION_REFERRAL_TYPE,
                code=code,
                extra={"discount_code_id": str(row.id)},
            )
            return json_response(
                404,
                {"error": "Discount code not found or inactive"},
                event=event,
            )

        unusable = _unusable_reason(row)
        if unusable is not None:
            reason_code, detail = unusable
            _log_discount_validate_rejection(
                reason_code,
                code=code,
                extra={"discount_code_id": str(row.id), **detail},
            )
            return json_response(
                404,
                {"error": "Discount code not found or inactive"},
                event=event,
            )

        if service_key_normalized:
            resolved_from_key, slug_unknown = _resolve_service_id_from_key_for_row(
                session,
                row,
                service_key_normalized,
            )
            if slug_unknown:
                _log_discount_validate_rejection(
                    _REJECTION_UNKNOWN_SERVICE_KEY,
                    code=code,
                    extra={"service_key": service_key_normalized},
                )
                return json_response(
                    404,
                    {"error": "Discount code not found or inactive"},
                    event=event,
                )
            resolved_service_id = resolved_from_key

        resolved_request_instance_id: UUID | None = None
        if service_instance_slug_normalized:
            instance_repo = ServiceInstanceRepository(session)
            resolved_from_slug = instance_repo.get_id_by_slug(
                service_instance_slug_normalized
            )
            if getattr(row, "instance_id", None) is not None:
                if resolved_from_slug is None:
                    _log_discount_validate_rejection(
                        _REJECTION_UNKNOWN_INSTANCE_SLUG,
                        code=code,
                        extra={
                            "discount_code_id": str(row.id),
                            "service_instance_slug": service_instance_slug_normalized,
                        },
                    )
                    return json_response(
                        404,
                        {"error": "Discount code not found or inactive"},
                        event=event,
                    )
                resolved_request_instance_id = resolved_from_slug

        scope_reason = _scope_rejection_reason(
            row,
            resolved_request_service_id=resolved_service_id,
            request_instance_id=resolved_request_instance_id,
        )
        if scope_reason is not None:
            reason_code, detail = scope_reason
            _log_discount_validate_rejection(
                reason_code,
                code=code,
                extra={"discount_code_id": str(row.id), **detail},
            )
            return json_response(
                404,
                {"error": "Discount code not found or inactive"},
                event=event,
            )

        rule = _discount_rule_payload(row)
        return json_response(
            200,
            {
                "valid": True,
                "is_valid": True,
                "data": rule,
                "discount": rule,
            },
            event=event,
        )


def _resolve_service_id_from_key_for_row(
    session: Session,
    row: DiscountCode,
    service_key: str,
) -> tuple[UUID | None, bool]:
    """Resolve `service_key` to a service id when needed for scope checks.

    Returns ``(resolved_service_id, slug_unknown)``. When ``slug_unknown`` is True,
    the slug did not match any ``services.slug`` row while the code requires that
    resolution (service-scoped code only).

    Instance-scoped codes ignore ``service_key`` for resolution (instance id is
    authoritative). Unscoped codes do not resolve the slug; an unknown slug must
    not invalidate the code.
    """
    instance_id = getattr(row, "instance_id", None)
    if instance_id is not None:
        return (None, False)

    service_id = getattr(row, "service_id", None)
    if service_id is None:
        return (None, False)

    svc = ServiceRepository(session).get_by_slug(service_key)
    if svc is None:
        return (None, True)
    return (svc.id, False)


def _scope_rejection_reason(
    row: DiscountCode,
    *,
    resolved_request_service_id: UUID | None,
    request_instance_id: UUID | None,
) -> tuple[str, dict[str, Any]] | None:
    """Return a rejection reason when scope does not match the request context."""
    instance_id = getattr(row, "instance_id", None)
    service_id = getattr(row, "service_id", None)
    if instance_id is not None:
        if request_instance_id is None:
            return (
                _REJECTION_INSTANCE_ID_REQUIRED,
                {"expected_service_instance_id": str(instance_id)},
            )
        if request_instance_id != instance_id:
            return (
                _REJECTION_INSTANCE_SCOPE_MISMATCH,
                {
                    "expected_service_instance_id": str(instance_id),
                    "request_service_instance_id": str(request_instance_id),
                },
            )
        return None
    if service_id is None:
        return None
    if resolved_request_service_id is None:
        return None
    if service_id != resolved_request_service_id:
        return (
            _REJECTION_SERVICE_SCOPE_MISMATCH,
            {
                "expected_service_id": str(service_id),
                "request_service_id": str(resolved_request_service_id),
            },
        )
    return None


def _discount_scope_allows_validate(
    row: DiscountCode,
    *,
    resolved_request_service_id: UUID | None,
    request_instance_id: UUID | None,
) -> bool:
    """Return False when scope does not match the request context."""
    return (
        _scope_rejection_reason(
            row,
            resolved_request_service_id=resolved_request_service_id,
            request_instance_id=request_instance_id,
        )
        is None
    )


def _unusable_reason(row: DiscountCode) -> tuple[str, dict[str, Any]] | None:
    """Return a rejection reason when the code cannot be used at the current time."""
    if not row.active:
        return (_REJECTION_INACTIVE, {"active": False})
    # Truncate to whole seconds so inclusive valid_until boundaries match values
    # stored at second (or coarser) resolution — aligns with OpenAPI "both ends inclusive".
    now = datetime.now(UTC).replace(microsecond=0)
    if row.valid_from is not None and row.valid_from > now:
        return (
            _REJECTION_NOT_YET_VALID,
            {"valid_from": row.valid_from.isoformat(), "now": now.isoformat()},
        )
    if row.valid_until is not None and row.valid_until < now:
        return (
            _REJECTION_EXPIRED,
            {"valid_until": row.valid_until.isoformat(), "now": now.isoformat()},
        )
    if row.max_uses is not None and row.current_uses >= row.max_uses:
        return (
            _REJECTION_MAX_USES,
            {
                "current_uses": row.current_uses,
                "max_uses": row.max_uses,
            },
        )
    return None


def _is_usable_now(row: DiscountCode) -> bool:
    return _unusable_reason(row) is None


def _discount_rule_payload(row: DiscountCode) -> dict[str, Any]:
    is_percentage = row.discount_type == DiscountType.PERCENTAGE
    amount = float(row.discount_value)
    currency_code = None if is_percentage else (row.currency or None)
    currency_symbol = (
        None if is_percentage else currency_symbol_for_iso_code(currency_code)
    )
    return {
        "code": row.code,
        "name": row.description,
        "amount": amount,
        "is_percentage": is_percentage,
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
    }
