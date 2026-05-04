"""Render FPS QR codes as PNG bytes for ReportLab ``Image``.

Uses `segno` (pure Python, no Pillow) for small Lambda packages. Error correction
level **H** matches the public site's `QRCode.toDataURL(..., errorCorrectionLevel: 'H')`
in ``apps/public_www/src/lib/fps-qr-code.ts``.
"""

from __future__ import annotations

import io

import segno


def render_fps_qr_png(payload: str, *, size_px: int = 256) -> bytes:
    """Return PNG bytes for ``payload`` near ``size_px`` square (integer module scale)."""
    if size_px <= 0:
        msg = "size_px must be positive"
        raise ValueError(msg)
    qr = segno.make(payload, error="h", micro=False)
    base_w, base_h = qr.symbol_size(scale=1)
    edge = max(base_w, base_h)
    scale = max(1, (size_px + edge - 1) // edge)
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=scale, border=0)
    return buf.getvalue()
