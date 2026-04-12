"""SES templates: booking confirmation (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.booking_confirmation_content import (
    BOOKING_CONFIRMATION_LOCALES,
    GREETING_HTML,
    HEADER_TITLE,
    PENDING_PAYMENT_NOTE,
    SIGN_OFF_PLAIN,
    SUBJECT_PREFIX,
    SUBJECT_SUFFIX,
    TABLE_LABELS,
    THANK_YOU_HTML,
    THANK_YOU_PLAIN,
    WHATSAPP_INTRO,
)
from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"


def _inner_html_and_text_for_locale(loc: str) -> tuple[str, str]:
    """Handlebars inner HTML and plain text (copy shared with MIME render module)."""
    labels = TABLE_LABELS[loc]
    border = "border-bottom:1px solid #eeeeee;"
    row_course = (
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["course"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{course_label}}</td></tr>"
    )
    row_date = (
        "{{#if schedule_date_label}}"
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["date"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{schedule_date_label}}</td></tr>"
        "{{/if}}"
    )
    row_time = (
        "{{#if schedule_time_label}}"
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["time"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{schedule_time_label}}</td></tr>"
        "{{/if}}"
    )
    row_payment = (
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["payment"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{payment_method}}</td></tr>"
    )
    row_total = (
        f'<tr><td style="padding:8px 0;"><strong>{labels["total"]}</strong></td>'
        '<td style="padding:8px 0;text-align:right;">{{total_amount}}</td></tr>'
    )
    pending = PENDING_PAYMENT_NOTE[loc]
    inner_html = (
        GREETING_HTML[loc]
        + THANK_YOU_HTML[loc]
        + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;margin:0 0 16px;">'
        + row_course
        + row_date
        + row_time
        + row_payment
        + row_total
        + "</table>"
        "{{#if is_pending_payment}}"
        '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;border-radius:8px;'
        'color:#5c4a00;">'
        f"{pending}"
        "</p>"
        "{{/if}}"
        f'<p style="margin:0 0 12px;">{WHATSAPP_INTRO[loc]}</p>'
        '<p style="margin:0;">'
        f'<a href="{{{{whatsapp_url}}}}" style="{_CTA_LINK}">WhatsApp</a>'
        "</p>"
    )

    label_sep = ": " if loc == "en" else "："
    greeting_plain = (
        "Hi {{full_name}},\n\n" if loc == "en" else "您好 {{full_name}}，\n\n"
    )
    text_part = (
        greeting_plain
        + THANK_YOU_PLAIN[loc]
        + f"{labels['course']}{label_sep}"
        + "{{course_label}}\n"
        + "{{#if schedule_date_label}}"
        + f"{labels['date']}{label_sep}"
        + "{{schedule_date_label}}\n"
        + "{{/if}}"
        + "{{#if schedule_time_label}}"
        + f"{labels['time']}{label_sep}"
        + "{{schedule_time_label}}\n"
        + "{{/if}}"
        + f"{labels['payment']}{label_sep}"
        + "{{payment_method}}\n"
        + f"{labels['total']}{label_sep}"
        + "{{total_amount}}\n\n"
        + "{{#if is_pending_payment}}"
        + f"{pending}\n\n"
        + "{{/if}}"
        + f"{WHATSAPP_INTRO[loc]}\n"
        + (
            "WhatsApp: {{whatsapp_url}}\n\n"
            if loc == "en"
            else "WhatsApp：{{whatsapp_url}}\n\n"
        )
        + SIGN_OFF_PLAIN[loc]
    )

    return inner_html, text_part


def get_ses_template_definitions() -> list[dict[str, Any]]:
    """Return SES CreateTemplate payloads (Template key for boto3)."""
    definitions: list[dict[str, Any]] = []
    for loc in BOOKING_CONFIRMATION_LOCALES:
        inner_html, text_part = _inner_html_and_text_for_locale(loc)
        definitions.append(
            {
                "TemplateName": f"evolvesprouts-booking-confirmation-{loc}",
                "SubjectPart": SUBJECT_PREFIX[loc]
                + "{{course_label}}"
                + SUBJECT_SUFFIX,
                "HtmlPart": wrap_transactional_html(
                    header_title=HEADER_TITLE[loc],
                    inner_html=inner_html,
                ),
                "TextPart": text_part,
            }
        )
    return definitions
