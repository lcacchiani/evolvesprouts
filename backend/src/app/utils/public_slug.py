"""Shared slug normalization for public-site identifiers (Mailchimp tags, resource keys)."""

from __future__ import annotations

import re
from typing import Any

_NON_ALNUM_RUNS = re.compile(r"[^a-z0-9]+")
DEFAULT_MAX_PUBLIC_SLUG_LENGTH = 64

# Public API / content: kebab-case slug (lowercase letters, digits, single hyphens).
PUBLIC_INSTANCE_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def normalize_public_slug(
    value: Any,
    *,
    max_length: int = DEFAULT_MAX_PUBLIC_SLUG_LENGTH,
) -> str | None:
    """Lowercase slug: non-alphanumeric runs to ``-``, trim, cap length.

    Returns ``None`` when the value is missing or empty after normalization.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    normalized = value.strip()
    if not normalized:
        return None
    slug = _NON_ALNUM_RUNS.sub("-", normalized.lower()).strip("-")
    if max_length > 0:
        slug = slug[:max_length].strip("-")
    return slug or None
