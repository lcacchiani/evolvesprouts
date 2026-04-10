"""SES templates: contact form confirmation (per locale)."""

from __future__ import annotations

from typing import Any


def _wrap_html(*, header_subtitle: str, inner_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f6f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0"
style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;background:#1a5f4a;color:#ffffff;">
<h1 style="margin:0;font-size:22px;line-height:1.3;">Evolve Sprouts</h1>
<p style="margin:8px 0 0;font-size:14px;opacity:0.95;">{header_subtitle}</p>
</td></tr>
<tr><td style="padding:28px;color:#333333;font-size:15px;line-height:1.6;">
{inner_html}
</td></tr>
<tr><td style="padding:16px 28px 24px;color:#666666;font-size:12px;line-height:1.5;">
<p style="margin:0;">Evolve Sprouts</p>
</td></tr>
</table></td></tr></table></body></html>"""


def get_ses_template_definitions() -> list[dict[str, Any]]:
    """Return SES CreateTemplate payloads (Template key for boto3)."""
    return [
        {
            "TemplateName": f"evolvesprouts-contact-confirmation-{loc}",
            "SubjectPart": subject,
            "HtmlPart": _wrap_html(header_subtitle=subject, inner_html=inner_html),
            "TextPart": text_part,
        }
        for loc, subject, inner_html, text_part in _LOCALE_ROWS
    ]


_LOCALE_ROWS: list[tuple[str, str, str, str]] = [
    (
        "en",
        "We received your message — Evolve Sprouts",
        (
            '<p style="margin:0 0 12px;">Hi {{first_name}},</p>'
            '<p style="margin:0 0 16px;">We received your message and will get back to you '
            "within 24–48 hours.</p>"
            '<p style="margin:0 0 12px;">'
            '<a href="{{faq_url}}" style="color:#1a5f4a;font-weight:600;">Visit our FAQ</a>'
            "</p>"
            '<p style="margin:0 0 12px;">'
            '<a href="{{whatsapp_url}}" style="color:#1a5f4a;font-weight:600;">'
            "Message us on WhatsApp</a>"
            "</p>"
            '<p style="margin:16px 0 0;">Thank you,<br/>Evolve Sprouts</p>'
        ),
        (
            "Hi {{first_name}},\n\n"
            "We received your message and will get back to you within 24–48 hours.\n\n"
            "FAQ: {{faq_url}}\n"
            "WhatsApp: {{whatsapp_url}}\n\n"
            "Thank you,\nEvolve Sprouts"
        ),
    ),
    (
        "zh-CN",
        "我们已收到您的留言 — Evolve Sprouts",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 16px;">我们已收到您的留言，并会在 24–48 小时内回复。</p>'
            '<p style="margin:0 0 12px;">'
            '<a href="{{faq_url}}" style="color:#1a5f4a;font-weight:600;">查看常见问题</a>'
            "</p>"
            '<p style="margin:0 0 12px;">'
            '<a href="{{whatsapp_url}}" style="color:#1a5f4a;font-weight:600;">通过 WhatsApp 联系我们</a>'
            "</p>"
            '<p style="margin:16px 0 0;">谢谢，<br/>Evolve Sprouts</p>'
        ),
        (
            "您好 {{first_name}}，\n\n"
            "我们已收到您的留言，并会在 24–48 小时内回复。\n\n"
            "常见问题：{{faq_url}}\n"
            "WhatsApp：{{whatsapp_url}}\n\n"
            "谢谢，\nEvolve Sprouts"
        ),
    ),
    (
        "zh-HK",
        "我們已收到您的留言 — Evolve Sprouts",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 16px;">我們已收到您的留言，並會在 24–48 小時內回覆。</p>'
            '<p style="margin:0 0 12px;">'
            '<a href="{{faq_url}}" style="color:#1a5f4a;font-weight:600;">查看常見問題</a>'
            "</p>"
            '<p style="margin:0 0 12px;">'
            '<a href="{{whatsapp_url}}" style="color:#1a5f4a;font-weight:600;">透過 WhatsApp 聯絡我們</a>'
            "</p>"
            '<p style="margin:16px 0 0;">謝謝，<br/>Evolve Sprouts</p>'
        ),
        (
            "您好 {{first_name}}，\n\n"
            "我們已收到您的留言，並會在 24–48 小時內回覆。\n\n"
            "常見問題：{{faq_url}}\n"
            "WhatsApp：{{whatsapp_url}}\n\n"
            "謝謝，\nEvolve Sprouts"
        ),
    ),
]
