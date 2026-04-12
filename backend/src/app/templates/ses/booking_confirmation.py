"""SES templates: booking confirmation (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.ses.email_shell import wrap_transactional_html


def get_ses_template_definitions() -> list[dict[str, Any]]:
    """Return SES CreateTemplate payloads (Template key for boto3)."""
    subjects = {
        "en": "Booking confirmed — {{course_label}} — Evolve Sprouts",
        "zh-CN": "预约确认 — {{course_label}} — Evolve Sprouts",
        "zh-HK": "預約確認 — {{course_label}} — Evolve Sprouts",
    }
    header_subtitles = {
        "en": "Booking confirmed",
        "zh-CN": "预约确认",
        "zh-HK": "預約確認",
    }
    return [
        {
            "TemplateName": f"evolvesprouts-booking-confirmation-{loc}",
            "SubjectPart": subjects[loc],
            "HtmlPart": wrap_transactional_html(
                header_subtitle=header_subtitles[loc],
                inner_html=inner_html,
            ),
            "TextPart": text_part,
        }
        for loc, inner_html, text_part in _LOCALE_ROWS
    ]


# Handlebars: optional rows and pending-payment note.
_HTML_EN = (
    '<p style="margin:0 0 12px;">Hi {{full_name}},</p>'
    '<p style="margin:0 0 16px;">Thank you for your booking!</p>'
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
    'style="border-collapse:collapse;margin:0 0 16px;">'
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>Course / event</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">{{course_label}}</td></tr>'
    "{{#if schedule_date_label}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>Date</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
    "{{schedule_date_label}}</td></tr>"
    "{{/if}}"
    "{{#if schedule_time_label}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>Time</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
    "{{schedule_time_label}}</td></tr>"
    "{{/if}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>Payment method</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">{{payment_method}}</td></tr>'
    '<tr><td style="padding:8px 0;"><strong>Total</strong></td>'
    '<td style="padding:8px 0;text-align:right;">{{total_amount}}</td></tr>'
    "</table>"
    "{{#if is_pending_payment}}"
    '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;border-radius:8px;color:#5c4a00;">'
    "Your reservation is pending until payment is confirmed."
    "</p>"
    "{{/if}}"
    '<p style="margin:0 0 12px;">Questions? Message us on WhatsApp:</p>'
    '<p style="margin:0;">'
    '<a href="{{whatsapp_url}}" style="color:#1a5f4a;font-weight:600;">WhatsApp</a>'
    "</p>"
    '<p style="margin:20px 0 0;">Thank you,<br/>Evolve Sprouts</p>'
)

_TEXT_EN = (
    "Hi {{full_name}},\n\n"
    "Thank you for your booking!\n\n"
    "Course / event: {{course_label}}\n"
    "{{#if schedule_date_label}}Date: {{schedule_date_label}}\n{{/if}}"
    "{{#if schedule_time_label}}Time: {{schedule_time_label}}\n{{/if}}"
    "Payment method: {{payment_method}}\n"
    "Total: {{total_amount}}\n\n"
    "{{#if is_pending_payment}}"
    "Your reservation is pending until payment is confirmed.\n\n"
    "{{/if}}"
    "WhatsApp: {{whatsapp_url}}\n\n"
    "Thank you,\nEvolve Sprouts"
)

_HTML_ZH_CN = (
    '<p style="margin:0 0 12px;">您好 {{full_name}}，</p>'
    '<p style="margin:0 0 16px;">感谢您的预订！</p>'
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
    'style="border-collapse:collapse;margin:0 0 16px;">'
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>课程 / 活动</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">{{course_label}}</td></tr>'
    "{{#if schedule_date_label}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>日期</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
    "{{schedule_date_label}}</td></tr>"
    "{{/if}}"
    "{{#if schedule_time_label}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>时间</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
    "{{schedule_time_label}}</td></tr>"
    "{{/if}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>付款方式</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">{{payment_method}}</td></tr>'
    '<tr><td style="padding:8px 0;"><strong>总额</strong></td>'
    '<td style="padding:8px 0;text-align:right;">{{total_amount}}</td></tr>'
    "</table>"
    "{{#if is_pending_payment}}"
    '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;border-radius:8px;color:#5c4a00;">'
    "在付款确认前，您的预订仍为待处理状态。"
    "</p>"
    "{{/if}}"
    '<p style="margin:0 0 12px;">有疑问？请通过 WhatsApp 联系我们：</p>'
    '<p style="margin:0;">'
    '<a href="{{whatsapp_url}}" style="color:#1a5f4a;font-weight:600;">WhatsApp</a>'
    "</p>"
    '<p style="margin:20px 0 0;">谢谢，<br/>Evolve Sprouts</p>'
)

_TEXT_ZH_CN = (
    "您好 {{full_name}}，\n\n"
    "感谢您的预订！\n\n"
    "课程 / 活动：{{course_label}}\n"
    "{{#if schedule_date_label}}日期：{{schedule_date_label}}\n{{/if}}"
    "{{#if schedule_time_label}}时间：{{schedule_time_label}}\n{{/if}}"
    "付款方式：{{payment_method}}\n"
    "总额：{{total_amount}}\n\n"
    "{{#if is_pending_payment}}"
    "在付款确认前，您的预订仍为待处理状态。\n\n"
    "{{/if}}"
    "WhatsApp：{{whatsapp_url}}\n\n"
    "谢谢，\nEvolve Sprouts"
)

_HTML_ZH_HK = (
    '<p style="margin:0 0 12px;">您好 {{full_name}}，</p>'
    '<p style="margin:0 0 16px;">多謝您的預訂！</p>'
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
    'style="border-collapse:collapse;margin:0 0 16px;">'
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>課程 / 活動</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">{{course_label}}</td></tr>'
    "{{#if schedule_date_label}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>日期</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
    "{{schedule_date_label}}</td></tr>"
    "{{/if}}"
    "{{#if schedule_time_label}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>時間</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
    "{{schedule_time_label}}</td></tr>"
    "{{/if}}"
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;"><strong>付款方式</strong></td>'
    '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">{{payment_method}}</td></tr>'
    '<tr><td style="padding:8px 0;"><strong>總額</strong></td>'
    '<td style="padding:8px 0;text-align:right;">{{total_amount}}</td></tr>'
    "</table>"
    "{{#if is_pending_payment}}"
    '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;border-radius:8px;color:#5c4a00;">'
    "在付款確認前，您的預訂仍為待處理狀態。"
    "</p>"
    "{{/if}}"
    '<p style="margin:0 0 12px;">有疑問？請透過 WhatsApp 聯絡我們：</p>'
    '<p style="margin:0;">'
    '<a href="{{whatsapp_url}}" style="color:#1a5f4a;font-weight:600;">WhatsApp</a>'
    "</p>"
    '<p style="margin:20px 0 0;">謝謝，<br/>Evolve Sprouts</p>'
)

_TEXT_ZH_HK = (
    "您好 {{full_name}}，\n\n"
    "多謝您的預訂！\n\n"
    "課程 / 活動：{{course_label}}\n"
    "{{#if schedule_date_label}}日期：{{schedule_date_label}}\n{{/if}}"
    "{{#if schedule_time_label}}時間：{{schedule_time_label}}\n{{/if}}"
    "付款方式：{{payment_method}}\n"
    "總額：{{total_amount}}\n\n"
    "{{#if is_pending_payment}}"
    "在付款確認前，您的預訂仍為待處理狀態。\n\n"
    "{{/if}}"
    "WhatsApp：{{whatsapp_url}}\n\n"
    "謝謝，\nEvolve Sprouts"
)

_LOCALE_ROWS: list[tuple[str, str, str]] = [
    ("en", _HTML_EN, _TEXT_EN),
    ("zh-CN", _HTML_ZH_CN, _TEXT_ZH_CN),
    ("zh-HK", _HTML_ZH_HK, _TEXT_ZH_HK),
]
