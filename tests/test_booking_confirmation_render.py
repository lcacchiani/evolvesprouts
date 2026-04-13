from __future__ import annotations

from app.templates.booking_confirmation_render import (
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
        payment_method_code="fps_qr",
        total_amount="HK$100.00",
        is_pending_payment=True,
        whatsapp_url="https://wa.me/123",
        include_fps_qr_image=True,
    )
    assert "预约确认" in subject
    assert "课程 A" in subject
    assert "王敏" in html_doc
    assert "服务" in html_doc
    assert "日期及时间" in html_doc
    assert "付款方式" in html_doc
    assert "FPS" in html_doc
    assert "cid:fps_qr" in html_doc
    assert "若您已完成付款" in html_doc
    assert "付款确认前" in plain
    assert "WhatsApp：" in plain


def test_render_booking_confirmation_en_omits_optional_schedule_rows() -> None:
    _subject, html_doc, plain = render_booking_confirmation_email(
        locale="en",
        full_name="Pat",
        course_label="Workshop",
        schedule_date_label=None,
        schedule_time_label=None,
        payment_method_code="bank_transfer",
        total_amount="HK$50.00",
        is_pending_payment=False,
        whatsapp_url="https://wa.me/x",
        include_fps_qr_image=False,
    )
    assert "Date &amp; time" not in html_doc
    assert "Bank Transfer" in html_doc
    assert "cid:fps_qr" not in html_doc
    assert "Date & time:" not in plain
    assert "WhatsApp: https://wa.me/x" in plain


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
