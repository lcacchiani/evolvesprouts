"""Integrity helpers for admin service routes (service_key + tier uniqueness)."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.exceptions import ValidationError

# Admin API `field` for duplicate (referral service_key, service_tier) unique violations (409).
SERVICE_KEY_TIER_UNIQUE_FIELD = "service_key_tier"


def service_key_tier_uniqueness_validation_error(
    *, service_key: str | None, service_tier: str | None
) -> ValidationError:
    """409 for duplicate (referral service_key, service tier) pair, including NULL/empty tier."""
    if service_key and service_tier:
        message = (
            "Another service already uses this service key with the same tier. "
            "Change the key or use a different tier."
        )
    elif service_key:
        message = (
            "Another service already uses this service key with an empty tier. "
            "Set a tier or change the key."
        )
    else:
        message = "Service key and tier combination conflicts with an existing service."
    return ValidationError(
        message, field=SERVICE_KEY_TIER_UNIQUE_FIELD, status_code=409
    )


def is_services_service_key_tier_unique_violation(exc: IntegrityError) -> bool:
    orig = getattr(exc.orig, "__cause__", None) or exc.orig
    diag = getattr(orig, "diag", None)
    constraint = getattr(diag, "constraint_name", None) if diag else None
    if constraint == "services_service_key_tier_unique_idx":
        return True
    message = str(exc).lower()
    if "services_service_key_tier_unique_idx" not in message:
        return False
    if "svc_instances_slug" in message:
        return False
    return True
