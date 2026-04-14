"""SES templates: booking confirmation (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.booking_confirmation_content import (
    BOOKING_CALENDAR_SES_FALLBACK_HINT,
    BOOKING_CONFIRMATION_LOCALES,
    CLOSING_NOTE,
    FAQ_LINK_LABEL,
    FPS_PAYMENT_DISCLAIMER,
    FPS_QR_INTRO,
    GREETING_HTML,
    HEADER_TITLE,
    PENDING_PAYMENT_NOTE,
    QUESTIONS_LINE_HTML_MIDDLE,
    QUESTIONS_LINE_HTML_PREFIX,
    QUESTIONS_LINE_HTML_SUFFIX,
    QUESTIONS_LINE_TEXT_SES,
    SIGN_OFF_PLAIN,
    SUBJECT_PREFIX,
    SUBJECT_SUFFIX,
    TABLE_LABELS,
    THANK_YOU_HTML,
    THANK_YOU_PLAIN,
    WHATSAPP_LINK_LABEL,
)
from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"


def _inner_html_and_text_for_locale(loc: str) -> tuple[str, str]:
    """Handlebars inner HTML and plain text (copy shared with MIME render module)."""
    labels = TABLE_LABELS[loc]
    border = "border-bottom:1px solid #eeeeee;"
    row_service = (
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["service"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{course_label}}</td></tr>"
    )
    row_details = (
        "{{#if details_block_html}}"
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["details"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{{details_block_html}}}</td></tr>"
        "{{/if}}"
    )
    row_datetime = (
        "{{#if schedule_datetime_label}}"
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["datetime"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{schedule_datetime_label}}</td></tr>"
        "{{/if}}"
    )
    row_location = (
        "{{#if location_name}}"
        f'<tr><td style="padding:8px 0;{border}"><strong>{labels["location"]}</strong></td>'
        '<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        "{{location_name}}</td></tr>"
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
    closing = CLOSING_NOTE[loc]
    questions_html = (
        f'<p style="margin:0;">{QUESTIONS_LINE_HTML_PREFIX[loc]}'
        f'<a href="{{{{whatsapp_url}}}}" style="{_CTA_LINK}">{WHATSAPP_LINK_LABEL[loc]}</a>'
        f"{QUESTIONS_LINE_HTML_MIDDLE[loc]}"
        f'<a href="{{{{faq_url}}}}" style="{_CTA_LINK}">{FAQ_LINK_LABEL[loc]}</a>'
        f"{QUESTIONS_LINE_HTML_SUFFIX[loc]}</p>"
    )
    inner_html = (
        GREETING_HTML[loc]
        + THANK_YOU_HTML[loc]
        + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;margin:0 0 16px;">'
        + row_service
        + row_details
        + row_datetime
        + row_location
        + row_payment
        + row_total
        + "</table>"
        "{{#if include_calendar_fallback_hint}}"
        '<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333333;">'
        f"{BOOKING_CALENDAR_SES_FALLBACK_HINT[loc]}"
        "</p>"
        "{{/if}}"
        "{{#if is_pending_payment}}"
        '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;border-radius:8px;'
        'color:#5c4a00;">'
        f"{pending}"
        "</p>"
        "{{/if}}"
        "{{#if include_fps_instructions}}"
        f'<p style="margin:0 0 8px;">{FPS_QR_INTRO[loc]}</p>'
        '<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#555555;">'
        f"{FPS_PAYMENT_DISCLAIMER[loc]}"
        "</p>"
        "{{/if}}"
        '<hr style="border:0;border-top:1px solid #eeeeee;margin:0 0 16px;"/>'
        f'<p style="margin:0 0 16px;">{closing}</p>' + questions_html
    )

    label_sep = ": " if loc == "en" else "："
    greeting_plain = (
        "Hi {{full_name}},\n\n" if loc == "en" else "您好 {{full_name}}，\n\n"
    )
    text_part = (
        greeting_plain
        + THANK_YOU_PLAIN[loc]
        + f"{labels['service']}{label_sep}"
        + "{{course_label}}\n"
        + "{{#if details_plain}}"
        + f"{labels['details']}{label_sep}\n"
        + "{{details_plain}}\n"
        + "{{/if}}"
        + "{{#if schedule_datetime_label}}"
        + f"{labels['datetime']}{label_sep}"
        + "{{schedule_datetime_label}}\n"
        + "{{/if}}"
        + "{{#if location_name}}"
        + f"{labels['location']}{label_sep}"
        + "{{location_name}}\n"
        + "{{/if}}"
        + f"{labels['payment']}{label_sep}"
        + "{{payment_method}}\n"
        + f"{labels['total']}{label_sep}"
        + "{{total_amount}}\n\n"
        + "{{#if include_calendar_fallback_hint}}"
        + f"{BOOKING_CALENDAR_SES_FALLBACK_HINT[loc]}\n\n"
        + "{{/if}}"
        + "{{#if is_pending_payment}}"
        + f"{pending}\n\n"
        + "{{/if}}"
        + "{{#if include_fps_instructions}}"
        + f"{FPS_QR_INTRO[loc]}\n"
        + f"{FPS_PAYMENT_DISCLAIMER[loc]}\n\n"
        + "{{/if}}"
        + f"{closing}\n\n"
        + QUESTIONS_LINE_TEXT_SES[loc]
        + "\n\n"
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
