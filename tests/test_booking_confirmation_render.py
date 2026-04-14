from __future__ import annotations

from app.templates.booking_confirmation_render import (
    build_booking_confirmation_ics,
    booking_confirmation_template_merge_data,
    render_booking_confirmation_email,
    substitute_shell_placeholders,
)


def test_render_booking_confirmation_zh_cn_includes_labels_and_fps_block() -> None:
    subject, html_doc, plain = render_booking_confirmation_email(
        locale="zh-CN",
        full_name="王敏",
        course_label="课程 A",
        schedule_date_label="4月12日",
        schedule_time_label=None,
        location_name="学习中心",
        location_address="香港中环",
        primary_session_iso="2026-04-12T10:30:00+08:00",
        course_slug="event-booking",
        payment_method_code="fps_qr",
        total_amount="HK$100.00",
        is_pending_payment=True,
        whatsapp_url="https://wa.me/123",
        faq_url="https://site.example/zh-CN/contact-us#contact-us-faq",
        include_fps_qr_image=True,
    )
    assert "预约确认" in subject
    assert "课程 A" in subject
    assert "王敏" in html_doc
    assert "服务" in html_doc
    assert "日期及时间" in html_doc
    assert "地点" in html_doc
    assert "学习中心" in html_doc
    assert "香港中环" in html_doc
    assert "付款方式" in html_doc
    assert "FPS" in html_doc
    assert "cid:fps_qr" in html_doc
    assert "若您已完成付款" in html_doc
    assert "<hr " in html_doc
    assert "期待与您见面" in html_doc
    assert "WhatsApp" in html_doc
    assert "常见问题" in html_doc
    assert "付款确认前" in plain
    assert "地点：" in plain
    assert "学习中心" in plain
    assert "期待与您见面" in plain


def test_render_booking_confirmation_en_hkt_from_iso() -> None:
    _subject, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="Pat",
        course_label="Workshop",
        schedule_date_label="Apr 16, 2026",
        schedule_time_label="6:00 pm",
        location_name="Evolve Sprouts",
        location_address="Sheung Wan, Hong Kong",
        primary_session_iso="2026-04-16T18:00:00+08:00",
        course_slug="event-booking",
        payment_method_code="bank_transfer",
        total_amount="HK$50.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/x",
        faq_url="https://site.example/en/contact-us#contact-us-faq",
        include_fps_qr_image=False,
    )
    assert "16 April @ 18:00 HKT" in html_doc
    assert "16 April @ 18:00 HKT" in plain
    assert "Evolve Sprouts, Sheung Wan, Hong Kong" in html_doc


def test_render_booking_confirmation_mba_details_and_skips_for_events() -> None:
    _subject, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="A",
        course_label="MBA",
        schedule_date_label="Apr, 2026",
        schedule_time_label="ignored when iso",
        location_name="Venue",
        location_address="1 Road, Hong Kong",
        primary_session_iso="2026-04-10T14:00:00+08:00",
        course_slug="my-best-auntie",
        age_group_label="18-24 months",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
    )
    assert "Cohort" in html_doc
    assert "Apr, 2026" in html_doc
    assert "Age group" in html_doc
    assert "18-24 months" in html_doc
    assert "First group session:" in html_doc
    assert "10 April @ 14:00 HKT" in html_doc
    assert "Cohort" in plain
    assert "First group session:" in plain
    assert "10 April @ 14:00 HKT" in plain

    _s2, html2, _p2 = render_booking_confirmation_email(
        locale="en",
        full_name="A",
        course_label="Event",
        schedule_date_label="May 1",
        schedule_time_label="10:00",
        location_name="X",
        location_address="Y",
        course_slug="event-booking",
        age_group_label="should-not-show",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
    )
    assert "Details" not in html2
    assert "Cohort" not in html2


def test_render_booking_confirmation_en_omits_optional_schedule_rows() -> None:
    _subject, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="Pat",
        course_label="Workshop",
        schedule_date_label=None,
        schedule_time_label=None,
        location_name=None,
        payment_method_code="bank_transfer",
        total_amount="HK$50.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/x",
        faq_url="https://site.example/en/contact-us#contact-us-faq",
        include_fps_qr_image=False,
    )
    assert "Date &amp; time" not in html_doc
    assert "Location" not in html_doc
    assert "Bank Transfer" in html_doc
    assert "cid:fps_qr" not in html_doc
    assert "We look forward to seeing you" in html_doc
    assert "FAQ" in html_doc
    assert "Date & time:" not in plain
    assert "Location:" not in plain
    assert "We look forward to seeing you" in plain
    assert "FAQ" in plain


def test_build_booking_confirmation_ics_primary_session_and_location() -> None:
    ics = build_booking_confirmation_ics(
        course_label="Workshop A",
        primary_session_iso="2026-04-16T10:00:00Z",
        location_line="Venue, Hong Kong",
    )
    assert ics is not None
    text = ics.decode("utf-8")
    assert "BEGIN:VCALENDAR" in text
    assert "BEGIN:VEVENT" in text
    assert "SUMMARY:Workshop A" in text
    assert "LOCATION:Venue\\, Hong Kong" in text
    assert "DTSTART:20260416T100000Z" in text
    assert "DTEND:20260416T110000Z" in text
    assert "UID:" in text
    # RFC 5545 folding inserts CRLF + space; unfold for stable substring checks.
    assert "@evolvesprouts.com" in text.replace("\r\n ", "")


def test_build_booking_confirmation_ics_uses_primary_session_end_iso() -> None:
    ics = build_booking_confirmation_ics(
        course_label="X",
        primary_session_iso="2026-04-16T10:00:00Z",
        primary_session_end_iso="2026-04-16T11:30:00Z",
        location_line=None,
    )
    assert ics is not None
    assert "DTEND:20260416T113000Z" in ics.decode("utf-8")


def test_build_booking_confirmation_ics_folds_long_utf8_summary_within_octet_limit() -> None:
    course = "课" * 40
    ics = build_booking_confirmation_ics(
        course_label=course,
        primary_session_iso="2026-04-16T10:00:00Z",
        location_line=None,
    )
    assert ics is not None
    for raw_line in ics.decode("utf-8").split("\r\n"):
        if not raw_line:
            continue
        assert len(raw_line.encode("utf-8")) <= 75


def test_build_booking_confirmation_ics_returns_none_without_iso() -> None:
    assert (
        build_booking_confirmation_ics(
            course_label="Y",
            primary_session_iso=None,
            location_line=None,
        )
        is None
    )


def test_booking_confirmation_template_merge_calendar_fallback_hint() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="C",
        schedule_date_label="May 1",
        schedule_time_label="10:00",
        primary_session_iso=None,
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
    )
    assert data.get("include_calendar_fallback_hint") is True

    data2 = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="C",
        schedule_date_label="May 1",
        schedule_time_label="10:00",
        primary_session_iso="2026-05-01T10:00:00+08:00",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
    )
    assert data2.get("include_calendar_fallback_hint") is False


def test_render_booking_confirmation_includes_ics_note_when_flagged() -> None:
    _s, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="Pat",
        course_label="Workshop",
        schedule_date_label=None,
        schedule_time_label=None,
        location_name=None,
        location_address=None,
        primary_session_iso="2026-04-10T14:00:00+08:00",
        payment_method_code="stripe",
        total_amount="HK$50.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/x",
        faq_url="https://site.example/en/contact-us#contact-us-faq",
        include_fps_qr_image=False,
        attach_calendar_invite_ics=True,
    )
    assert "calendar invite" in html_doc.lower()
    assert "ics" in html_doc.lower()
    assert "calendar invite" in plain.lower()


def test_render_booking_confirmation_mba_zh_cn_uses_localized_ordinals() -> None:
    _s, html_doc, plain = render_booking_confirmation_email(
        locale="zh-CN",
        full_name="王",
        course_label="课程",
        schedule_date_label="2026年4月",
        schedule_time_label="ignored",
        location_name="场地",
        location_address="香港",
        primary_session_iso="2026-04-10T14:00:00+08:00",
        course_slug="my-best-auntie",
        age_group_label="1-3",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
        course_sessions=[
            {"start_iso": "2026-04-10T14:00:00+08:00"},
            {"start_iso": "2026-05-01T14:00:00+08:00"},
        ],
    )
    assert "第一节" in html_doc
    assert "第二节" in html_doc
    assert "第一节" in plain


def test_render_booking_confirmation_event_multi_part_course_sessions() -> None:
    _s, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="A",
        course_label="Event",
        schedule_date_label="ignored",
        schedule_time_label="ignored",
        location_name="Venue",
        location_address="Hong Kong",
        primary_session_iso="2026-04-10T14:00:00+08:00",
        course_slug="event-booking",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
        course_sessions=[
            {"start_iso": "2026-04-10T14:00:00+08:00"},
            {"start_iso": "2026-05-01T14:00:00+08:00"},
        ],
    )
    assert "10 April @ 14:00 HKT" in html_doc
    assert "1 May @ 14:00 HKT" in html_doc
    assert "10 April @ 14:00 HKT" in plain
    assert "1 May @ 14:00 HKT" in plain


def test_booking_confirmation_merge_data_sets_multiline_flags_for_ses() -> None:
    data = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="MBA",
        schedule_date_label="Apr",
        schedule_time_label="x",
        location_name="V",
        location_address="Hong Kong",
        primary_session_iso="2026-04-10T14:00:00+08:00",
        course_slug="my-best-auntie",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        course_sessions=[
            {"start_iso": "2026-04-10T14:00:00+08:00"},
            {"start_iso": "2026-05-01T14:00:00+08:00"},
        ],
        location_url="https://maps.example/x",
    )
    assert data.get("schedule_datetime_plain_multiline") is True
    assert data.get("location_plain_multiline") is True

    data_single = booking_confirmation_template_merge_data(
        locale="en",
        full_name="A",
        course_label="E",
        schedule_date_label=None,
        schedule_time_label=None,
        location_name="V",
        location_address="Hong Kong",
        primary_session_iso="2026-04-16T18:00:00+08:00",
        course_slug="event-booking",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
    )
    assert "schedule_datetime_plain_multiline" not in data_single
    assert "location_plain_multiline" not in data_single


def test_render_booking_confirmation_mba_multi_session_email_lines() -> None:
    _s, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="A",
        course_label="MBA",
        schedule_date_label="Apr, 2026",
        schedule_time_label="ignored",
        location_name="Venue",
        location_address="Hong Kong",
        primary_session_iso="2026-04-10T14:00:00+08:00",
        course_slug="my-best-auntie",
        age_group_label="18-24 months",
        payment_method_code="stripe",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
        course_sessions=[
            {"start_iso": "2026-04-10T14:00:00+08:00"},
            {"start_iso": "2026-05-01T14:00:00+08:00"},
        ],
    )
    assert "First group session:" in html_doc
    assert "Second group session:" in html_doc
    assert "10 April @ 14:00 HKT" in html_doc
    assert "1 May @ 14:00 HKT" in html_doc
    assert "Second group session:" in plain


def test_render_booking_confirmation_consultation_am_pm_from_iso() -> None:
    _s, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="Pat",
        course_label="Consultation",
        schedule_date_label="Apr 2026",
        schedule_time_label="ignored",
        location_name="HK",
        location_address="Hong Kong",
        primary_session_iso="2026-04-12T14:30:00+08:00",
        course_slug="consultation-booking",
        payment_method_code="stripe",
        total_amount="HK$100.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/x",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
    )
    assert "12 April PM" in html_doc
    assert "12 April PM" in plain


def test_render_booking_confirmation_location_includes_directions_link() -> None:
    _s, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="Pat",
        course_label="Workshop",
        schedule_date_label=None,
        schedule_time_label=None,
        location_name="Venue",
        location_address="Sheung Wan, Hong Kong",
        primary_session_iso="2026-04-16T18:00:00+08:00",
        course_slug="event-booking",
        payment_method_code="stripe",
        total_amount="HK$50.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/x",
        faq_url="https://site.example/faq",
        include_fps_qr_image=False,
        location_url="https://maps.example/dir",
    )
    assert "Get Directions" in html_doc
    assert 'href="https://maps.example/dir"' in html_doc
    assert "Get Directions: https://maps.example/dir" in plain


def test_substitute_shell_placeholders_replaces_logo_and_footer() -> None:
    _s, html_doc, _p = render_booking_confirmation_email(
        locale="en",
        full_name="A",
        course_label="B",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method_code="m",
        total_amount="HK$1",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/1",
        include_fps_qr_image=False,
    )
    out = substitute_shell_placeholders(
        html_doc,
        {
            "logo_url": "https://cdn.example/logo.png",
            "site_home_url": "https://site.example/en/",
            "faq_url": "https://site.example/en/faq",
            "footer_block_html": "<p>Footer</p>",
        },
    )
    assert "https://cdn.example/logo.png" in out
    assert "https://site.example/en/" in out
    assert "<p>Footer</p>" in out
