"""SES templates: media download link (per locale)."""

from __future__ import annotations

from typing import Any

from app.templates.ses.email_shell import wrap_transactional_html

_BUTTON = (
    "display:inline-block;padding:12px 24px;background:#C84A16;"
    "color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;"
)
_LINK = "color:#C84A16;font-weight:600;text-decoration:none;"
_HR = '<hr style="border:none;border-top:1px solid #eeeeee;margin:24px 0;"/>'
_SECTION_H2 = "margin:24px 0 10px 0;font-size:18px;line-height:1.35;font-weight:700;color:#333333;"
_BOX = (
    "margin:24px 0 0 0;padding:18px 20px;background-color:#FDF5EF;"
    "border:1px solid #C84A16;border-radius:10px;"
)
_BOX_H3 = (
    "margin:0 0 12px 0;font-size:17px;line-height:1.35;font-weight:700;color:#333333;"
)
_OL = "margin:0 0 16px;padding-left:22px;"
_LI = "margin:0 0 8px;"


def get_ses_template_definitions() -> list[dict[str, Any]]:
    """Return SES CreateTemplate payloads (Template key for boto3)."""
    return [
        {
            "TemplateName": f"evolvesprouts-media-download-{loc}",
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
        "Your free guide is ready — Evolve Sprouts",
        "YOUR FREE GUIDE IS HERE!",
        (
            '<p style="margin:0 0 12px;">Hi {{first_name}},</p>'
            '<p style="margin:0 0 20px;">Here is your download link for <strong>{{media_name}}</strong>.</p>'
            '<p style="margin:0 0 16px;">'
            f'<a href="{{{{download_url}}}}" style="{_BUTTON}">Download your free guide</a>'
            "</p>"
            '<p style="margin:0 0 8px;font-size:13px;color:#555555;">If the button does not work, '
            "copy this URL:</p>"
            '<p style="margin:0 0 0 0;word-break:break-all;font-size:13px;color:#C84A16;">'
            "{{download_url}}</p>"
            f"{_HR}"
            f'<h2 style="{_SECTION_H2}">What you\'ll find inside</h2>'
            '<p style="margin:0 0 12px 0;">Gentle, Montessori-inspired strategies you can start using '
            "today, whether it's you or your helper spending time with your child.</p>"
            "<p style=\"margin:0 0 16px 0;\">These aren't abstract theories. They're practical, everyday "
            "tools that work in real Hong Kong family life.</p>"
            f"<h2 style=\"{_SECTION_H2}\">Here's what I'd suggest</h2>"
            f'<ol style="{_OL}">'
            f'<li style="{_LI}">Read through the guide, it\'s short and practical</li>'
            f'<li style="{_LI}">Pick one strategy to try this week</li>'
            f'<li style="{_LI}">Notice what changes, even small shifts matter</li>'
            "</ol>"
            '<p style="margin:0 0 0 0;">And if you have questions or want to go deeper, '
            "I'm always happy to chat.</p>"
            f'<div style="{_BOX}">'
            f'<h3 style="{_BOX_H3}">Want hands-on support?</h3>'
            '<p style="margin:0 0 14px 0;">'
            f'<a href="{{{{my_best_auntie_url}}}}" style="{_LINK}">My Best Auntie</a> '
            "is a 9-week Montessori training programme for domestic helpers — so your child gets "
            "consistent, confident care every day.</p>"
            '<p style="margin:0;">Or '
            f'<a href="{{{{free_intro_call_url}}}}" style="{_LINK}">book a free intro call</a> '
            "to see what's right for your family.</p>"
            "</div>"
        ),
        (
            "Hi {{first_name}},\n\n"
            "Here is your download link for {{media_name}}.\n\n"
            "{{download_url}}\n\n"
            "---\n\n"
            "What you'll find inside\n\n"
            "Gentle, Montessori-inspired strategies you can start using today, whether it's you or "
            "your helper spending time with your child.\n\n"
            "These aren't abstract theories. They're practical, everyday tools that work in real Hong "
            "Kong family life.\n\n"
            "Here's what I'd suggest\n\n"
            "1. Read through the guide, it's short and practical\n"
            "2. Pick one strategy to try this week\n"
            "3. Notice what changes, even small shifts matter\n\n"
            "And if you have questions or want to go deeper, I'm always happy to chat.\n\n"
            "Want hands-on support?\n\n"
            "My Best Auntie ({{my_best_auntie_url}}) is a 9-week Montessori training programme for "
            "domestic helpers — so your child gets consistent, confident care every day.\n\n"
            "Or book a free intro call ({{free_intro_call_url}}) to see what's right for your family.\n\n"
            "Thank you,\nEvolve Sprouts"
        ),
    ),
    (
        "zh-CN",
        "您的免费资料已准备好 — Evolve Sprouts",
        "您的免费指南就在这里！",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 20px;">这是 <strong>{{media_name}}</strong> 的下载链接。</p>'
            '<p style="margin:0 0 16px;">'
            f'<a href="{{{{download_url}}}}" style="{_BUTTON}">下载您的免费指南</a>'
            "</p>"
            '<p style="margin:0 0 8px;font-size:13px;color:#555555;">若按钮无法使用，请复制以下网址：</p>'
            '<p style="margin:0 0 0 0;word-break:break-all;font-size:13px;color:#C84A16;">'
            "{{download_url}}</p>"
            f"{_HR}"
            f'<h2 style="{_SECTION_H2}">您将了解到</h2>'
            '<p style="margin:0 0 12px 0;">温和、受蒙特梭利启发的实用方法，您今天就可以开始运用——无论陪伴孩子的'
            "是您本人还是家政助手。</p>"
            '<p style="margin:0 0 16px 0;">这些不是抽象理论，而是融入香港家庭日常生活的具体工具。</p>'
            f'<h2 style="{_SECTION_H2}">我的建议</h2>'
            f'<ol style="{_OL}">'
            f'<li style="{_LI}">先通读指南，内容简短、重在实操</li>'
            f'<li style="{_LI}">本周先选一项策略尝试</li>'
            f'<li style="{_LI}">留意变化，哪怕是很小的转变也值得肯定</li>'
            "</ol>"
            '<p style="margin:0 0 0 0;">若您有疑问或想更深入交流，欢迎随时与我联系。</p>'
            f'<div style="{_BOX}">'
            f'<h3 style="{_BOX_H3}">需要实操支持？</h3>'
            '<p style="margin:0 0 14px 0;">'
            f'<a href="{{{{my_best_auntie_url}}}}" style="{_LINK}">My Best Auntie</a> '
            "是一门为期 9 周、面向家政助手的蒙特梭利培训课程，帮助孩子每天获得稳定而自信的照护。</p>"
            '<p style="margin:0;">或 '
            f'<a href="{{{{free_intro_call_url}}}}" style="{_LINK}">预约免费咨询通话</a>，'
            "一起看看哪种方式最适合您的家庭。</p>"
            "</div>"
        ),
        (
            "您好 {{first_name}}，\n\n"
            "这是 {{media_name}} 的下载链接：\n\n"
            "{{download_url}}\n\n"
            "---\n\n"
            "您将了解到\n\n"
            "温和、受蒙特梭利启发的实用方法，您今天就可以开始运用——无论陪伴孩子的是您本人还是家政助手。\n\n"
            "这些不是抽象理论，而是融入香港家庭日常生活的具体工具。\n\n"
            "我的建议\n\n"
            "1. 先通读指南，内容简短、重在实操\n"
            "2. 本周先选一项策略尝试\n"
            "3. 留意变化，哪怕是很小的转变也值得肯定\n\n"
            "若您有疑问或想更深入交流，欢迎随时与我联系。\n\n"
            "需要实操支持？\n\n"
            "My Best Auntie（{{my_best_auntie_url}}）是一门为期 9 周、面向家政助手的蒙特梭利培训课程，"
            "帮助孩子每天获得稳定而自信的照护。\n\n"
            "或预约免费咨询通话（{{free_intro_call_url}}），一起看看哪种方式最适合您的家庭。\n\n"
            "谢谢，\nEvolve Sprouts"
        ),
    ),
    (
        "zh-HK",
        "您的免費資料已準備好 — Evolve Sprouts",
        "您的免費指南就在這裡！",
        (
            '<p style="margin:0 0 12px;">您好 {{first_name}}，</p>'
            '<p style="margin:0 0 20px;">這是 <strong>{{media_name}}</strong> 的下載連結。</p>'
            '<p style="margin:0 0 16px;">'
            f'<a href="{{{{download_url}}}}" style="{_BUTTON}">下載您的免費指南</a>'
            "</p>"
            '<p style="margin:0 0 8px;font-size:13px;color:#555555;">若按鈕無法使用，請複製以下網址：</p>'
            '<p style="margin:0 0 0 0;word-break:break-all;font-size:13px;color:#C84A16;">'
            "{{download_url}}</p>"
            f"{_HR}"
            f'<h2 style="{_SECTION_H2}">您將了解到</h2>'
            '<p style="margin:0 0 12px 0;">溫和、受蒙特梭利啟發的實用方法，您今天就可以開始運用——無論陪伴孩子的是'
            "您本人還是家傭。</p>"
            '<p style="margin:0 0 16px 0;">這些不是抽象理論，而是融入香港家庭日常生活的具體工具。</p>'
            f'<h2 style="{_SECTION_H2}">我的建議</h2>'
            f'<ol style="{_OL}">'
            f'<li style="{_LI}">先通讀指南，內容簡短、重在實操</li>'
            f'<li style="{_LI}">本週先選一項策略嘗試</li>'
            f'<li style="{_LI}">留意變化，哪怕是很小的轉變也值得肯定</li>'
            "</ol>"
            '<p style="margin:0 0 0 0;">若您有疑問或想更深入交流，歡迎隨時與我聯絡。</p>'
            f'<div style="{_BOX}">'
            f'<h3 style="{_BOX_H3}">需要實操支援？</h3>'
            '<p style="margin:0 0 14px 0;">'
            f'<a href="{{{{my_best_auntie_url}}}}" style="{_LINK}">My Best Auntie</a> '
            "是一門為期 9 週、面向家傭的蒙特梭利培訓課程，讓孩子每天獲得穩定而自信的照顧。</p>"
            '<p style="margin:0;">或 '
            f'<a href="{{{{free_intro_call_url}}}}" style="{_LINK}">預約免費諮詢通話</a>，'
            "一起看看哪種方式最適合您的家庭。</p>"
            "</div>"
        ),
        (
            "您好 {{first_name}}，\n\n"
            "這是 {{media_name}} 的下載連結：\n\n"
            "{{download_url}}\n\n"
            "---\n\n"
            "您將了解到\n\n"
            "溫和、受蒙特梭利啟發的實用方法，您今天就可以開始運用——無論陪伴孩子的是您本人還是家傭。\n\n"
            "這些不是抽象理論，而是融入香港家庭日常生活的具體工具。\n\n"
            "我的建議\n\n"
            "1. 先通讀指南，內容簡短、重在實操\n"
            "2. 本週先選一項策略嘗試\n"
            "3. 留意變化，哪怕是很小的轉變也值得肯定\n\n"
            "若您有疑問或想更深入交流，歡迎隨時與我聯絡。\n\n"
            "需要實操支援？\n\n"
            "My Best Auntie（{{my_best_auntie_url}}）是一門為期 9 週、面向家傭的蒙特梭利培訓課程，"
            "讓孩子每天獲得穩定而自信的照顧。\n\n"
            "或預約免費諮詢通話（{{free_intro_call_url}}），一起看看哪種方式最適合您的家庭。\n\n"
            "謝謝，\nEvolve Sprouts"
        ),
    ),
]
