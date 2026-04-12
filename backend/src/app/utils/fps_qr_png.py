"""Decode FPS QR PNG data URLs from the public booking modal."""

from __future__ import annotations

import base64
import binascii
from typing import Any

_MAX_FPS_QR_DATA_URL_CHARS = 50_000
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def decode_fps_qr_png_data_url(raw: str) -> bytes | None:
    """Accept only ``data:image/png;base64,...`` payloads from the booking modal QR."""
    s = raw.strip()
    if len(s) > _MAX_FPS_QR_DATA_URL_CHARS:
        return None
    prefix = "data:image/png;base64,"
    if not s.lower().startswith(prefix):
        return None
    b64_part = s[len(prefix) :].strip()
    if not b64_part or "\n" in b64_part or "\r" in b64_part:
        return None
    try:
        decoded = base64.b64decode(b64_part, validate=True)
    except (binascii.Error, ValueError):
        return None
    if len(decoded) > 512_000 or not decoded.startswith(_PNG_MAGIC):
        return None
    return decoded


def optional_fps_qr_data_url_from_payload(value: Any) -> str | None:
    """Normalize optional ``fps_qr_image_data_url`` from JSON."""
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None
