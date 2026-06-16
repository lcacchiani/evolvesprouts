from __future__ import annotations

import pytest

from app.services.fps_qr_pdf_image import render_fps_qr_png


def test_render_fps_qr_png_returns_png_bytes() -> None:
    png_bytes = render_fps_qr_png("fps-payload-example", size_px=128)

    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png_bytes) > 100


def test_render_fps_qr_png_rejects_non_positive_size() -> None:
    with pytest.raises(ValueError, match="size_px must be positive"):
        render_fps_qr_png("fps-payload-example", size_px=0)
