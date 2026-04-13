from __future__ import annotations

from app.templates.booking_confirmation_render import (
    booking_confirmation_template_merge_data,
    format_schedule_datetime_line,
    resolve_payment_method_display,
)


def test_format_schedule_datetime_line_joins_or_prefers_parts() -> None:
    assert format_schedule_datetime_line("Apr 2026", "10:00 – 11:00") == "Apr 2026 10:00 – 11:00"
    assert format_schedule_datetime_line("", "Mon, 12 Apr 2026 AM") == "Mon, 12 Apr 2026 AM"
    assert format_schedule_datetime_line("Apr, 2026", "") == "Apr, 2026"
    assert format_schedule_datetime_line(None, None) is None


def test_resolve_payment_method_display() -> None:
    assert resolve_payment_method_display("fps_qr") == "FPS"
    assert resolve_payment_method_display("stripe") == "Credit Card"
    assert resolve_payment_method_display("bank_transfer") == "Bank Transfer"
    assert resolve_payment_method_display("other") == "other"


def test_booking_confirmation_template_merge_data_consultation_details() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="Consultation",
        schedule_date_label="Apr 2026",
        schedule_time_label="Mon, 12 Apr 2026 AM",
        payment_method_code="fps_qr",
        total_amount="HK$1,234.00",
        is_pending_payment=True,
        whatsapp_url="https://wa.me/1",
        consultation_writing_focus_label="College essays",
        consultation_level_label="Essentials",
    )
    assert data["schedule_datetime_label"] == "Apr 2026 Mon, 12 Apr 2026 AM"
    assert data["payment_method"] == "FPS"
    assert data["include_fps_instructions"] is True
    assert "Consultation" in data["details_block_html"]
    assert "College essays" in data["details_block_html"]
    assert "Writing focus" in data["details_plain"]
