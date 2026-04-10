"""SES templates: media download link (per locale)."""

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
            "TemplateName": f"evolvesprouts-media-download-{loc}",
            "SubjectPart": subject,
            "HtmlPart": _wrap_html(header_subtitle=subject, inner_html=inner_html),
            "TextPart": text_part,
        }
        for loc, subject, inner_html, text_part in _LOCALE_ROWS
    ]


_LOCALE_ROWS: list[tuple[str, str, str, str]] = [
    (
        "en",
        "Your free guide is ready — Evolve Sprouts",
        (
            '<p style="margin:0 0 12px;">Hi {{first_name}},</p>'
            '<p style="margin:0 0 20px;">Here is your download link for <strong>{{media_name}}</strong>.</p>'
            '<p style="margin:0 0 16px;text-align:center;">'
            '<a href="{{download_url}}" style="display:inline-block;padding:12px 24px;background:#1a5f4a;'
            'color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Download</a>'
            "</p>"
            '<p style="margin:0 0 8px;font-size:13px;color:#555555;">If the button does not work, '
            "copy this URL:</p>"
            '<p style="margin:0;word-break:break-all;font-size:13px;color:#1a5f4a;">{{download_url}}</p>'
            '<p style="margin:20px 0 0;">Thank you,<br/>Evolve Sprouts</p>'
        ),
        (
            "Hi {{first_name}},\n\n"
            "Here is your download link for {{media_name}}.\n\n"
            "{{download_url}}\n\n"
            "Thank you,\nEvolve Sprouts"
        ),
    ),
    (
        "zh-CN",
        "您的免费资料已准备好 — Evolve Sprouts",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 20px;">这是 <strong>{{media_name}}</strong> 的下载链接。</p>'
            '<p style="margin:0 0 16px;text-align:center;">'
            '<a href="{{download_url}}" style="display:inline-block;padding:12px 24px;background:#1a5f4a;'
            'color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">下载</a>'
            "</p>"
            '<p style="margin:0 0 8px;font-size:13px;color:#555555;">若按钮无法使用，请复制以下网址：</p>'
            '<p style="margin:0;word-break:break-all;font-size:13px;color:#1a5f4a;">{{download_url}}</p>'
            '<p style="margin:20px 0 0;">谢谢，<br/>Evolve Sprouts</p>'
        ),
        (
            "您好 {{first_name}}，\n\n"
            "这是 {{media_name}} 的下载链接：\n\n"
            "{{download_url}}\n\n"
            "谢谢，\nEvolve Sprouts"
        ),
    ),
    (
        "zh-HK",
        "您的免費資料已準備好 — Evolve Sprouts",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 20px;">這是 <strong>{{media_name}}</strong> 的下載連結。</p>'
            '<p style="margin:0 0 16px;text-align:center;">'
            '<a href="{{download_url}}" style="display:inline-block;padding:12px 24px;background:#1a5f4a;'
            'color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">下載</a>'
            "</p>"
            '<p style="margin:0 0 8px;font-size:13px;color:#555555;">若按鈕無法使用，請複製以下網址：</p>'
            '<p style="margin:0;word-break:break-all;font-size:13px;color:#1a5f4a;">{{download_url}}</p>'
            '<p style="margin:20px 0 0;">謝謝，<br/>Evolve Sprouts</p>'
        ),
        (
            "您好 {{first_name}}，\n\n"
            "這是 {{media_name}} 的下載連結：\n\n"
            "{{download_url}}\n\n"
            "謝謝，\nEvolve Sprouts"
        ),
    ),
]
