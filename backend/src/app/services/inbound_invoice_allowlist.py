"""Optional allowlist for inbound invoice email senders (envelope or From header)."""

from __future__ import annotations

import os


def load_inbound_invoice_sender_patterns() -> tuple[str, ...]:
    """Parse comma-separated case-insensitive substring patterns from env.

    Empty or unset ``INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS`` means no filtering
    (all senders allowed).
    """
    raw = os.getenv("INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS", "").strip()
    if not raw:
        return ()
    return tuple(p.strip().lower() for p in raw.split(",") if p.strip())


def inbound_invoice_sender_is_allowed(
    *,
    envelope_from: str | None,
    header_from: str | None,
    patterns: tuple[str, ...] | None = None,
) -> bool:
    """Return True when allowlist is disabled or any pattern matches any sender.

    Matching is case-insensitive substring on the full email address string
    (e.g. ``@vendor.com`` or ``billing@``). Both SES envelope ``source`` and
    RFC822 ``From`` address are checked so forwarding setups can match either.
    """
    if patterns is None:
        patterns = load_inbound_invoice_sender_patterns()
    if not patterns:
        return True

    candidates: list[str] = []
    for addr in (header_from, envelope_from):
        if addr and str(addr).strip():
            normalized = str(addr).strip().lower()
            if normalized not in candidates:
                candidates.append(normalized)

    if not candidates:
        return False

    for pattern in patterns:
        for email in candidates:
            if pattern in email:
                return True
    return False
