"""SES templates: free intro-call confirmation (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.booking_confirmation_content import (
    BOOKING_CONFIRMATION_LOCALES,
    INTRO_CALL_CANCEL_FOOTER_HTML,
    INTRO_CALL_CANCEL_FOOTER_PLAIN,
    INTRO_CALL_CONFIRMATION_SUBJECT,
    INTRO_CALL_CONFIRMATION_THANK_YOU_HTML,
    INTRO_CALL_LEAD_HTML,
    INTRO_CALL_SHELL_HEADER,
    INTRO_CALL_SUPPORT_LINE_HTML,
    FAQ_LINK_LABEL,
    QUESTIONS_LINE_HTML_MIDDLE,
    QUESTIONS_LINE_HTML_PREFIX,
    QUESTIONS_LINE_HTML_SUFFIX,
    QUESTIONS_LINE_TEXT_SES,
    SIGN_OFF_PLAIN,
    WHATSAPP_LINK_LABEL,
)
from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"


def _greeting_html(loc: str) -> str:
    return (
        '<p style="margin:0 0 12px;">Hi {{full_name}},</p>'
        if loc == "en"
        else '<p style="margin:0 0 12px;">您好 {{full_name}}，</p>'
    )


def _inner_html_for_locale(loc: str) -> tuple[str, str]:
    thank = INTRO_CALL_CONFIRMATION_THANK_YOU_HTML[loc]
    lead = INTRO_CALL_LEAD_HTML[loc]
    slot_row = (
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#333333;">'
        "{{intro_call_slot_hkt}}</p>"
    )
    topics = "{{{intro_call_topics_html}}}"
    cancel = INTRO_CALL_CANCEL_FOOTER_HTML[loc]
    support = INTRO_CALL_SUPPORT_LINE_HTML[loc]
    questions = (
        f'<p style="margin:0;">{QUESTIONS_LINE_HTML_PREFIX[loc]}'
        f'<a href="{{{{whatsapp_url}}}}" style="{_CTA_LINK}">'
        f"{WHATSAPP_LINK_LABEL[loc]}</a>"
        f"{QUESTIONS_LINE_HTML_MIDDLE[loc]}"
        f'<a href="{{{{faq_url}}}}" style="{_CTA_LINK}">'
        f"{FAQ_LINK_LABEL[loc]}</a>"
        f"{QUESTIONS_LINE_HTML_SUFFIX[loc]}</p>"
    )
    inner = (
        _greeting_html(loc)
        + thank
        + lead
        + slot_row
        + topics
        + cancel
        + support
        + questions
    )
    greeting_plain = (
        "Hi {{full_name}},\n\n" if loc == "en" else "您好 {{full_name}}，\n\n"
    )
    text = (
        greeting_plain
        + "{{intro_call_topics_plain}}"
        + "{{intro_call_heading}}\n"
        + "{{intro_call_slot_hkt}}\n\n"
        + INTRO_CALL_CANCEL_FOOTER_PLAIN[loc]
        + "{{support_email_line_plain}}\n\n"
        + QUESTIONS_LINE_TEXT_SES[loc]
        + "\n\n"
        + SIGN_OFF_PLAIN[loc]
    )
    return inner, text


def get_ses_template_definitions() -> list[dict[str, Any]]:
    definitions: list[dict[str, Any]] = []
    for loc in BOOKING_CONFIRMATION_LOCALES:
        inner_html, text_part = _inner_html_for_locale(loc)
        definitions.append(
            {
                "TemplateName": f"evolvesprouts-intro-call-confirmation-{loc}",
                "SubjectPart": INTRO_CALL_CONFIRMATION_SUBJECT[loc],
                "HtmlPart": wrap_transactional_html(
                    header_title=INTRO_CALL_SHELL_HEADER[loc],
                    inner_html=inner_html,
                ),
                "TextPart": text_part,
            }
        )
    return definitions
