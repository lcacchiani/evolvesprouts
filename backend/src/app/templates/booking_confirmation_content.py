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
        "course": "Course / event",
        "date": "Date",
        "time": "Time",
        "payment": "Payment method",
        "total": "Total",
    },
    "zh-CN": {
        "course": "课程 / 活动",
        "date": "日期",
        "time": "时间",
        "payment": "付款方式",
        "total": "总额",
    },
    "zh-HK": {
        "course": "課程 / 活動",
        "date": "日期",
        "time": "時間",
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

WHATSAPP_INTRO: dict[str, str] = {
    "en": "Questions? Message us on WhatsApp:",
    "zh-CN": "有疑问？请通过 WhatsApp 联系我们：",
    "zh-HK": "有疑問？請透過 WhatsApp 聯絡我們：",
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
