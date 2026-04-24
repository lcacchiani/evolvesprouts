from __future__ import annotations

from app.templates.booking_confirmation_content import resolve_service_row_label
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


def test_resolve_service_row_label_falls_back_for_unknown_slug() -> None:
    assert resolve_service_row_label("en", "unknown", "My Title") == "My Title"


def test_booking_confirmation_template_merge_data_consultation_details() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="Consultation",
        schedule_date_label="Apr 2026",
        schedule_time_label="Mon, 12 Apr 2026 AM",
        course_slug="consultation-booking",
        primary_session_iso="2026-04-12T10:30:00+08:00",
        payment_method_code="fps_qr",
        total_amount="HK$1,234.00",
        is_pending_payment=True,
        whatsapp_url="https://wa.me/1",
        consultation_writing_focus_label="College essays",
        consultation_level_label="Essentials",
    )
    assert data["service_row_label"] == "Consultation"
    assert data["schedule_datetime_label_html"] == "12 April in the morning"
    assert data["payment_method"] == "FPS"
    assert data["include_fps_instructions"] is True
    assert "College essays" in data["details_block_html"]
    assert "Focus" in data["details_block_html"]
    assert "Level" in data["details_plain"]


def test_booking_confirmation_hkt_schedule_from_iso() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="X",
        schedule_date_label="ignored",
        schedule_time_label="ignored",
        location_name="HK venue",
        location_address="Hong Kong",
        primary_session_iso="2026-04-16T18:00:00+08:00",
        course_slug="event-booking",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
    )
    assert data["schedule_datetime_label_html"] == "16 April @ 18:00 HKT"


def test_booking_confirmation_merge_consultation_en_uses_morning_afternoon() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="Consultation",
        schedule_date_label="Apr 2026",
        schedule_time_label="ignored",
        location_name="Venue",
        location_address="Hong Kong",
        primary_session_iso="2026-04-12T10:30:00+08:00",
        course_slug="consultation-booking",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
    )
    assert data["schedule_datetime_label_html"] == "12 April in the morning"


def test_booking_confirmation_template_merge_includes_directions_when_url() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="Workshop",
        schedule_date_label=None,
        schedule_time_label=None,
        location_name="Venue",
        location_address="Hong Kong",
        primary_session_iso="2026-04-16T18:00:00+08:00",
        course_slug="event-booking",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        location_url="https://maps.example/dir",
    )
    assert "Get Directions" in data["location_block_html"]
    assert "https://maps.example/dir" in data["location_block_html"]
    assert "Venue" in data["location_block_html"]
    assert "Hong Kong" in data["location_block_html"]
    assert "Get Directions: https://maps.example/dir" in data["location_plain"]
    assert "Venue\nHong Kong" in data["location_plain"]


def test_booking_confirmation_template_merge_data_free_omits_payment() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="Workshop",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method_code="free",
        total_amount="HK$0.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        is_free=True,
    )
    assert "payment_method" not in data
    assert data["total_amount"] == "Free"
    assert data["is_free"] is True
    assert data["is_pending_payment"] is False
    assert data["include_fps_instructions"] is False


def test_booking_confirmation_template_merge_data_service_row_label_from_slug() -> None:
    data = booking_confirmation_template_merge_data(
        locale="zh-CN",
        full_name="A",
        course_label="家庭咨询预约",
        service_slug="consultation",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method_code="free",
        total_amount="HK$0.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        is_free=True,
    )
    assert data["service_row_label"] == "咨询"
