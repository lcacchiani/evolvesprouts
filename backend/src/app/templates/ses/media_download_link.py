"""SES templates: media download link (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.ses.email_shell import wrap_transactional_html


def get_ses_template_definitions() -> list[dict[str, Any]]:
    """Return SES CreateTemplate payloads (Template key for boto3)."""
    return [
        {
            "TemplateName": f"evolvesprouts-media-download-{loc}",
            "SubjectPart": subject,
            "HtmlPart": wrap_transactional_html(
                header_subtitle=subject, inner_html=inner_html
            ),
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
