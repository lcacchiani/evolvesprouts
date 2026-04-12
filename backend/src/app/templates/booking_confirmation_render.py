"""Render booking confirmation email bodies (non-SES-template path for inline images)."""

from __future__ import annotations

import html
from typing import Any

from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"

_SUBJECT_PREFIX = {
    "en": "Booking confirmed — ",
    "zh-CN": "预约确认 — ",
    "zh-HK": "預約確認 — ",
}
_SUBJECT_SUFFIX = " — Evolve Sprouts"

_HEADER_TITLES = {
    "en": "You're all set — booking confirmed",
    "zh-CN": "预订已确认",
    "zh-HK": "預訂已確認",
}

_FPS_QR_INTRO = {
    "en": "Use the FPS QR code below with your banking app to pay.",
    "zh-CN": "请使用下方 FPS 二维码，通过您的银行应用付款。",
    "zh-HK": "請使用下方 FPS 二維碼，透過您的銀行應用程式付款。",
}

_PENDING_NOTE = {
    "en": "Your reservation is pending until payment is confirmed.",
    "zh-CN": "在付款确认前，您的预订仍为待处理状态。",
    "zh-HK": "在付款確認前，您的預訂仍為待處理狀態。",
}

_WHATSAPP_INTRO = {
    "en": "Questions? Message us on WhatsApp:",
    "zh-CN": "有疑问？请通过 WhatsApp 联系我们：",
    "zh-HK": "有疑問？請透過 WhatsApp 聯絡我們：",
}


def _loc(locale: str) -> str:
    return locale if locale in _HEADER_TITLES else "en"


def _table_row_en(label: str, value: str) -> str:
    esc_label = html.escape(label)
    return (
        f'<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;">'
        f"<strong>{esc_label}</strong></td>"
        f'<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        f"{value}</td></tr>"
    )


def _table_row_final_en(label: str, value: str) -> str:
    esc_label = html.escape(label)
    return (
        f'<tr><td style="padding:8px 0;"><strong>{esc_label}</strong></td>'
        f'<td style="padding:8px 0;text-align:right;">{value}</td></tr>'
    )


def render_booking_confirmation_email(
    *,
    locale: str,
    full_name: str,
    course_label: str,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    payment_method: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    include_fps_qr_image: bool,
) -> tuple[str, str, str]:
    """Return (subject, full_html, plain_text)."""
    loc = _loc(locale)
    esc_name = html.escape(full_name.strip())
    esc_course = html.escape(course_label.strip())
    esc_pm = html.escape(payment_method.strip())
    esc_total = html.escape(total_amount)
    esc_wa = html.escape(whatsapp_url.strip(), quote=True)

    labels = _labels_for_locale(loc)

    rows_html: list[str] = [
        _table_row_en(labels["course"], esc_course),
    ]
    if schedule_date_label and schedule_date_label.strip():
        rows_html.append(
            _table_row_en(labels["date"], html.escape(schedule_date_label.strip()))
        )
    if schedule_time_label and schedule_time_label.strip():
        rows_html.append(
            _table_row_en(labels["time"], html.escape(schedule_time_label.strip()))
        )
    rows_html.append(_table_row_en(labels["payment"], esc_pm))
    rows_html.append(_table_row_final_en(labels["total"], esc_total))

    table_html = (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;margin:0 0 16px;">'
        + "".join(rows_html)
        + "</table>"
    )

    thank_you = _thank_you_html(loc)
    greeting = _greeting_html(loc, esc_name)

    pending_block = ""
    if is_pending_payment:
        pending_block = (
            '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;'
            'border-radius:8px;color:#5c4a00;">'
            f"{html.escape(_PENDING_NOTE[loc])}"
            "</p>"
        )

    fps_block = ""
    if include_fps_qr_image:
        fps_block = (
            f'<p style="margin:0 0 8px;">{html.escape(_FPS_QR_INTRO[loc])}</p>'
            '<p style="margin:0 0 16px;text-align:center;">'
            '<img src="cid:fps_qr" width="128" height="128" alt="FPS QR code" '
            'style="display:inline-block;border:0;outline:none;"/>'
            "</p>"
        )

    inner_html = (
        f'{greeting}<p style="margin:0 0 16px;">{thank_you}</p>'
        f"{table_html}{pending_block}{fps_block}"
        f'<p style="margin:0 0 12px;">{html.escape(_WHATSAPP_INTRO[loc])}</p>'
        f'<p style="margin:0;">'
        f'<a href="{esc_wa}" style="{_CTA_LINK}">WhatsApp</a>'
        f"</p>"
    )

    header = _HEADER_TITLES[loc]
    full_html_template = wrap_transactional_html(
        header_title=header,
        inner_html=inner_html,
    )

    subject = (
        f"{_SUBJECT_PREFIX[loc]}{course_label.strip()}{_SUBJECT_SUFFIX}"
    )

    text_lines = _build_plain_text(
        loc=loc,
        full_name=full_name.strip(),
        course_label=course_label.strip(),
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        payment_method=payment_method.strip(),
        total_amount=total_amount,
        is_pending_payment=is_pending_payment,
        whatsapp_url=whatsapp_url.strip(),
        include_fps_qr_image=include_fps_qr_image,
    )
    plain_text = "\n".join(text_lines)

    return subject, full_html_template, plain_text


def substitute_shell_placeholders(
    html_document: str, shell_data: dict[str, Any]
) -> str:
    """Fill ``wrap_transactional_html`` placeholders from shell merge data."""
    out = html_document
    footer_html = shell_data.get("footer_block_html")
    if isinstance(footer_html, str):
        out = out.replace("{{{footer_block_html}}}", footer_html)
    for key in ("logo_url", "site_home_url", "faq_url"):
        val = shell_data.get(key)
        if isinstance(val, str):
            out = out.replace("{{" + key + "}}", val)
    return out


def _labels_for_locale(loc: str) -> dict[str, str]:
    if loc == "zh-CN":
        return {
            "course": "课程 / 活动",
            "date": "日期",
            "time": "时间",
            "payment": "付款方式",
            "total": "总额",
        }
    if loc == "zh-HK":
        return {
            "course": "課程 / 活動",
            "date": "日期",
            "time": "時間",
            "payment": "付款方式",
            "total": "總額",
        }
    return {
        "course": "Course / event",
        "date": "Date",
        "time": "Time",
        "payment": "Payment method",
        "total": "Total",
    }


def _greeting_html(loc: str, escaped_name: str) -> str:
    if loc == "zh-CN":
        return f'<p style="margin:0 0 12px;">您好 {escaped_name}，</p>'
    if loc == "zh-HK":
        return f'<p style="margin:0 0 12px;">您好 {escaped_name}，</p>'
    return f'<p style="margin:0 0 12px;">Hi {escaped_name},</p>'


def _thank_you_html(loc: str) -> str:
    if loc == "zh-CN":
        return "感谢您的预订！"
    if loc == "zh-HK":
        return "多謝您的預訂！"
    return "Thank you for your booking!"


def _build_plain_text(
    *,
    loc: str,
    full_name: str,
    course_label: str,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    payment_method: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    include_fps_qr_image: bool,
) -> list[str]:
    labels = _labels_for_locale(loc)
    lines: list[str] = []
    if loc == "zh-CN":
        lines.append(f"您好 {full_name}，\n")
        lines.append("感谢您的预订！\n")
    elif loc == "zh-HK":
        lines.append(f"您好 {full_name}，\n")
        lines.append("多謝您的預訂！\n")
    else:
        lines.append(f"Hi {full_name},\n")
        lines.append("Thank you for your booking!\n")
    lines.append(f"{labels['course']}：{course_label}\n")
    if schedule_date_label and schedule_date_label.strip():
        lines.append(f"{labels['date']}：{schedule_date_label.strip()}\n")
    if schedule_time_label and schedule_time_label.strip():
        lines.append(f"{labels['time']}：{schedule_time_label.strip()}\n")
    lines.append(f"{labels['payment']}：{payment_method}\n")
    lines.append(f"{labels['total']}：{total_amount}\n\n")
    if is_pending_payment:
        lines.append(f"{_PENDING_NOTE[loc]}\n\n")
    if include_fps_qr_image:
        lines.append(f"{_FPS_QR_INTRO[loc]}\n")
        lines.append("[FPS QR code image is attached as fps-qr.png]\n\n")
    lines.append(f"{_WHATSAPP_INTRO[loc]}\n")
    if loc == "en":
        lines.append(f"WhatsApp: {whatsapp_url}\n\n")
    else:
        lines.append(f"WhatsApp：{whatsapp_url}\n\n")
    if loc == "zh-CN":
        lines.append("谢谢，\nEvolve Sprouts")
    elif loc == "zh-HK":
        lines.append("謝謝，\nEvolve Sprouts")
    else:
        lines.append("Thank you,\nEvolve Sprouts")
    return lines
