"""Shared copy and table labels for booking confirmation (SES templates + MIME render)."""

from __future__ import annotations

from typing import Final

# Locales supported by both SES stored templates and the MIME fallback path.
BOOKING_CONFIRMATION_LOCALES: Final[tuple[str, ...]] = ("en", "zh-CN", "zh-HK")

SUBJECT_PREFIX: dict[str, str] = {
    "en": "Booking confirmed — ",
    "zh-CN": "预约确认 — ",
    "zh-HK": "預約確認 — ",
}
SUBJECT_SUFFIX: Final[str] = " — Evolve Sprouts"

HEADER_TITLE: dict[str, str] = {
    "en": "You're all set — booking confirmed",
    "zh-CN": "预订已确认",
    "zh-HK": "預訂已確認",
}

TABLE_LABELS: dict[str, dict[str, str]] = {
    "en": {
        "service": "Service",
        "datetime": "Date & time",
        "location": "Location",
        "details": "Details",
        "payment": "Payment method",
        "total": "Total",
    },
    "zh-CN": {
        "service": "服务",
        "datetime": "日期及时间",
        "location": "地点",
        "details": "详情",
        "payment": "付款方式",
        "total": "总额",
    },
    "zh-HK": {
        "service": "服務",
        "datetime": "日期及時間",
        "location": "地點",
        "details": "詳情",
        "payment": "付款方式",
        "total": "總額",
    },
}

PENDING_PAYMENT_NOTE: dict[str, str] = {
    "en": "Your reservation is pending until payment is confirmed.",
    "zh-CN": "在付款确认前，您的预订仍为待处理状态。",
    "zh-HK": "在付款確認前，您的預訂仍為待處理狀態。",
}

FPS_QR_INTRO: dict[str, str] = {
    "en": "Use the FPS QR code below with your banking app to pay.",
    "zh-CN": "请使用下方 FPS 二维码，通过您的银行应用付款。",
    "zh-HK": "請使用下方 FPS 二維碼，透過您的銀行應用程式付款。",
}

FPS_PAYMENT_DISCLAIMER: dict[str, str] = {
    "en": "If you have already completed payment, you can ignore the QR code below.",
    "zh-CN": "若您已完成付款，请忽略下方的二维码。",
    "zh-HK": "若您已完成付款，請忽略下方的二維碼。",
}

# Sub-lines inside the HTML "Details" row (consultation bookings).
DETAILS_WRITING_FOCUS_PREFIX: dict[str, str] = {
    "en": "Focus",
    "zh-CN": "重点",
    "zh-HK": "重點",
}
DETAILS_LEVEL_PREFIX: dict[str, str] = {
    "en": "Level",
    "zh-CN": "级别",
    "zh-HK": "級別",
}

# My Best Auntie — Details row (cohort + age group).
DETAILS_COHORT_PREFIX: dict[str, str] = {
    "en": "Cohort",
    "zh-CN": "班级",
    "zh-HK": "班級",
}
DETAILS_AGE_GROUP_PREFIX: dict[str, str] = {
    "en": "Age group",
    "zh-CN": "年龄组",
    "zh-HK": "年齡組",
}

# Customer-facing payment method line in confirmation (maps reservation payload codes).
PAYMENT_METHOD_LABELS: dict[str, str] = {
    "fps_qr": "FPS",
    "bank_transfer": "Bank Transfer",
    "stripe": "Credit Card",
}

CLOSING_NOTE: dict[str, str] = {
    "en": "We look forward to seeing you! If you have any questions beforehand, we're happy to help.",
    "zh-CN": "期待与您见面！如有任何问题，欢迎随时联系我们。",
    "zh-HK": "期待與您見面！如有任何問題，歡迎隨時聯絡我們。",
}

# HTML: link labels embedded in QUESTIONS_LINE_HTML_PREFIX / SUFFIX (Handlebars URLs).
WHATSAPP_LINK_LABEL: dict[str, str] = {
    "en": "WhatsApp",
    "zh-CN": "WhatsApp",
    "zh-HK": "WhatsApp",
}
FAQ_LINK_LABEL: dict[str, str] = {
    "en": "FAQ",
    "zh-CN": "常见问题",
    "zh-HK": "常見問題",
}

QUESTIONS_LINE_HTML_PREFIX: dict[str, str] = {
    "en": "Questions? Message us on ",
    "zh-CN": "有疑问？请通过 ",
    "zh-HK": "有疑問？請透過 ",
}
QUESTIONS_LINE_HTML_MIDDLE: dict[str, str] = {
    "en": ", or check our ",
    "zh-CN": " 联系我们，或查看 ",
    "zh-HK": " 聯絡我們，或查看 ",
}
QUESTIONS_LINE_HTML_SUFFIX: dict[str, str] = {
    "en": " for quick answers.",
    "zh-CN": " 获取快速解答。",
    "zh-HK": " 獲取快速解答。",
}

# Plain body for MIME render (Python .format).
QUESTIONS_LINE_PLAIN: dict[str, str] = {
    "en": "Questions? Message us on WhatsApp ({whatsapp_url}), or check our FAQ ({faq_url}) for quick answers.",
    "zh-CN": "有疑问？请通过 WhatsApp（{whatsapp_url}）联系我们，或查看常见问题（{faq_url}）获取快速解答。",
    "zh-HK": "有疑問？請透過 WhatsApp（{whatsapp_url}）聯絡我們，或查看常見問題（{faq_url}）獲取快速解答。",
}

# SES TextPart uses Handlebars-style {{placeholders}} (merged with shell + template_data).
QUESTIONS_LINE_TEXT_SES: dict[str, str] = {
    "en": "Questions? Message us on WhatsApp ({{whatsapp_url}}), or check our FAQ ({{faq_url}}) for quick answers.",
    "zh-CN": "有疑问？请通过 WhatsApp（{{whatsapp_url}}）联系我们，或查看常见问题（{{faq_url}}）获取快速解答。",
    "zh-HK": "有疑問？請透過 WhatsApp（{{whatsapp_url}}）聯絡我們，或查看常見問題（{{faq_url}}）獲取快速解答。",
}

# Greeting / thank-you HTML fragments (SES Handlebars); same prose as MIME render.
GREETING_HTML: dict[str, str] = {
    "en": '<p style="margin:0 0 12px;">Hi {{full_name}},</p>',
    "zh-CN": '<p style="margin:0 0 12px;">您好 {{full_name}}，</p>',
    "zh-HK": '<p style="margin:0 0 12px;">您好 {{full_name}}，</p>',
}

THANK_YOU_HTML: dict[str, str] = {
    "en": '<p style="margin:0 0 16px;">Thank you for your booking!</p>',
    "zh-CN": '<p style="margin:0 0 16px;">感谢您的预订！</p>',
    "zh-HK": '<p style="margin:0 0 16px;">多謝您的預訂！</p>',
}

# Plain-text thank-you / sign-off (first line after name block, last lines).
THANK_YOU_PLAIN: dict[str, str] = {
    "en": "Thank you for your booking!\n",
    "zh-CN": "感谢您的预订！\n",
    "zh-HK": "多謝您的預訂！\n",
}

SIGN_OFF_PLAIN: dict[str, str] = {
    "en": "Thank you,\nEvolve Sprouts",
    "zh-CN": "谢谢，\nEvolve Sprouts",
    "zh-HK": "謝謝，\nEvolve Sprouts",
}


def normalize_booking_locale(locale: str) -> str:
    return locale if locale in HEADER_TITLE else "en"
