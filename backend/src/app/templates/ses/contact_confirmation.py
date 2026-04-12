"""SES templates: contact form confirmation (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"


def get_ses_template_definitions() -> list[dict[str, Any]]:
    """Return SES CreateTemplate payloads (Template key for boto3)."""
    return [
        {
            "TemplateName": f"evolvesprouts-contact-confirmation-{loc}",
            "SubjectPart": subject,
            "HtmlPart": wrap_transactional_html(
                header_title=header_title,
                inner_html=inner_html,
            ),
            "TextPart": text_part,
        }
        for loc, subject, header_title, inner_html, text_part in _LOCALE_ROWS
    ]


_LOCALE_ROWS: list[tuple[str, str, str, str, str]] = [
    (
        "en",
        "We received your message — Evolve Sprouts",
        "Your message is in safe hands",
        (
            '<p style="margin:0 0 12px;">Hi {{first_name}},</p>'
            '<p style="margin:0 0 16px;">We received your message and will get back to you '
            "within 24-48 hours.</p>"
            '<p style="margin:0 0 12px;">'
            f'<a href="{{{{faq_url}}}}" style="{_CTA_LINK}">Visit our FAQ</a>'
            "</p>"
            '<p style="margin:0 0 12px;">'
            f'<a href="{{{{whatsapp_url}}}}" style="{_CTA_LINK}">'
            "Message us on WhatsApp</a>"
            "</p>"
        ),
        (
            "Hi {{first_name}},\n\n"
            "We received your message and will get back to you within 24-48 hours.\n\n"
            "FAQ: {{faq_url}}\n"
            "WhatsApp: {{whatsapp_url}}\n\n"
            "Thank you,\nEvolve Sprouts"
        ),
    ),
    (
        "zh-CN",
        "我们已收到您的留言 — Evolve Sprouts",
        "您的留言我们已妥善收到",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 16px;">我们已收到您的留言，并会在 24-48 小时内回复。</p>'
            '<p style="margin:0 0 12px;">'
            f'<a href="{{{{faq_url}}}}" style="{_CTA_LINK}">查看常见问题</a>'
            "</p>"
            '<p style="margin:0 0 12px;">'
            f'<a href="{{{{whatsapp_url}}}}" style="{_CTA_LINK}">通过 WhatsApp 联系我们</a>'
            "</p>"
        ),
        (
            "您好 {{first_name}}，\n\n"
            "我们已收到您的留言，并会在 24-48 小时内回复。\n\n"
            "常见问题：{{faq_url}}\n"
            "WhatsApp：{{whatsapp_url}}\n\n"
            "谢谢，\nEvolve Sprouts"
        ),
    ),
    (
        "zh-HK",
        "我們已收到您的留言 — Evolve Sprouts",
        "您的留言我們已妥善收到",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 16px;">我們已收到您的留言，並會在 24-48 小時內回覆。</p>'
            '<p style="margin:0 0 12px;">'
            f'<a href="{{{{faq_url}}}}" style="{_CTA_LINK}">查看常見問題</a>'
            "</p>"
            '<p style="margin:0 0 12px;">'
            f'<a href="{{{{whatsapp_url}}}}" style="{_CTA_LINK}">透過 WhatsApp 聯絡我們</a>'
            "</p>"
        ),
        (
            "您好 {{first_name}}，\n\n"
            "我們已收到您的留言，並會在 24-48 小時內回覆。\n\n"
            "常見問題：{{faq_url}}\n"
            "WhatsApp：{{whatsapp_url}}\n\n"
            "謝謝，\nEvolve Sprouts"
        ),
    ),
]
