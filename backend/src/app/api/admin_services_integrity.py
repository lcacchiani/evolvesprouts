"""Integrity helpers for admin service routes (slug + tier uniqueness)."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.exceptions import ValidationError

# Admin API `field` for duplicate (referral slug, service_tier) unique violations (409).
SERVICE_SLUG_TIER_UNIQUE_FIELD = "slug_tier"


def slug_tier_uniqueness_validation_error(
    *, slug: str | None, service_tier: str | None
) -> ValidationError:
    """409 for duplicate (referral slug, service tier) pair, including NULL/empty tier."""
    if slug and service_tier:
        message = (
            "Another service already uses this referral slug with the same tier. "
            "Change the slug or use a different tier."
        )
    elif slug:
        message = (
            "Another service already uses this referral slug with an empty tier. "
            "Set a tier or change the slug."
        )
    else:
        message = (
            "Service slug and tier combination conflicts with an existing service."
        )
    return ValidationError(message, field=SERVICE_SLUG_TIER_UNIQUE_FIELD, status_code=409)


def is_services_slug_tier_unique_violation(exc: IntegrityError) -> bool:
    orig = getattr(exc.orig, "__cause__", None) or exc.orig
    diag = getattr(orig, "diag", None)
    constraint = getattr(diag, "constraint_name", None) if diag else None
    if constraint == "services_slug_tier_unique_idx":
        return True
    message = str(exc).lower()
    if "services_slug_tier_unique_idx" not in message:
        return False
    if "svc_instances_slug" in message:
        return False
    return True
