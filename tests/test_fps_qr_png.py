from __future__ import annotations

from app.utils.fps_qr_png import optional_fps_qr_data_url_from_payload


def test_optional_fps_qr_data_url_from_payload() -> None:
    assert optional_fps_qr_data_url_from_payload("  x  ") == "x"
    assert optional_fps_qr_data_url_from_payload("") is None
    assert optional_fps_qr_data_url_from_payload(None) is None
    assert optional_fps_qr_data_url_from_payload(123) is None
