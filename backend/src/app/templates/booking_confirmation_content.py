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
        "details": "Details",
        "payment": "Payment method",
        "total": "Total",
    },
    "zh-CN": {
        "service": "服务",
        "datetime": "日期及时间",
        "details": "详情",
        "payment": "付款方式",
        "total": "总额",
    },
    "zh-HK": {
        "service": "服務",
        "datetime": "日期及時間",
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
DETAILS_CONSULTATION_KIND: dict[str, str] = {
    "en": "Consultation",
    "zh-CN": "咨询",
    "zh-HK": "諮詢",
}
DETAILS_WRITING_FOCUS_PREFIX: dict[str, str] = {
    "en": "Writing focus",
    "zh-CN": "写作重点",
    "zh-HK": "寫作重點",
}
DETAILS_LEVEL_PREFIX: dict[str, str] = {
    "en": "Level",
    "zh-CN": "级别",
    "zh-HK": "級別",
}

# Customer-facing payment method line in confirmation (maps reservation payload codes).
PAYMENT_METHOD_LABELS: dict[str, str] = {
    "fps_qr": "FPS",
    "bank_transfer": "Bank Transfer",
    "stripe": "Credit Card",
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
