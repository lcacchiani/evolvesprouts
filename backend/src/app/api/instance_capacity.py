"""Shared helpers for service instance seat math (display vs booking)."""


def compute_capacity_left_effective(
    *,
    max_capacity: int | None,
    capacity_enrolled_count: int,
    capacity_left_override: int | None,
) -> int | None:
    """Display-only remaining seats; independent of booking guards."""
    if max_capacity is None:
        return None
    remaining = max(0, max_capacity - capacity_enrolled_count)
    if capacity_left_override is not None:
        return min(capacity_left_override, remaining)
    return remaining
