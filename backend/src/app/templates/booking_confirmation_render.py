"""Render booking confirmation email bodies (MIME path with inline FPS QR image)."""

from __future__ import annotations

import html
from typing import Any

from app.templates.booking_confirmation_content import (
    FPS_QR_INTRO,
    HEADER_TITLE,
    PENDING_PAYMENT_NOTE,
    SIGN_OFF_PLAIN,
    SUBJECT_PREFIX,
    SUBJECT_SUFFIX,
    TABLE_LABELS,
    THANK_YOU_HTML,
    THANK_YOU_PLAIN,
    WHATSAPP_INTRO,
    normalize_booking_locale,
)
from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"


def _html_table_row_bordered(label: str, value_html: str) -> str:
    esc_label = html.escape(label)
    return (
        f'<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;">'
        f"<strong>{esc_label}</strong></td>"
        f'<td style="padding:8px 0;border-bottom:1px solid #eeeeee;text-align:right;">'
        f"{value_html}</td></tr>"
    )


def _html_table_row_final(label: str, value_html: str) -> str:
    esc_label = html.escape(label)
    return (
        f'<tr><td style="padding:8px 0;"><strong>{esc_label}</strong></td>'
        f'<td style="padding:8px 0;text-align:right;">{value_html}</td></tr>'
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
    loc = normalize_booking_locale(locale)
    labels = TABLE_LABELS[loc]
    esc_name = html.escape(full_name.strip())
    esc_course = html.escape(course_label.strip())
    esc_pm = html.escape(payment_method.strip())
    esc_total = html.escape(total_amount)
    esc_wa = html.escape(whatsapp_url.strip(), quote=True)

    greeting = (
        f'<p style="margin:0 0 12px;">Hi {esc_name},</p>'
        if loc == "en"
        else f'<p style="margin:0 0 12px;">您好 {esc_name}，</p>'
    )

    rows_html: list[str] = [
        _html_table_row_bordered(labels["course"], esc_course),
    ]
    if schedule_date_label and schedule_date_label.strip():
        rows_html.append(
            _html_table_row_bordered(
                labels["date"],
                html.escape(schedule_date_label.strip()),
            )
        )
    if schedule_time_label and schedule_time_label.strip():
        rows_html.append(
            _html_table_row_bordered(
                labels["time"],
                html.escape(schedule_time_label.strip()),
            )
        )
    rows_html.append(_html_table_row_bordered(labels["payment"], esc_pm))
    rows_html.append(_html_table_row_final(labels["total"], esc_total))

    table_html = (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;margin:0 0 16px;">'
        + "".join(rows_html)
        + "</table>"
    )

    pending_block = ""
    if is_pending_payment:
        pending_block = (
            '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;'
            'border-radius:8px;color:#5c4a00;">'
            f"{html.escape(PENDING_PAYMENT_NOTE[loc])}"
            "</p>"
        )

    fps_block = ""
    if include_fps_qr_image:
        fps_block = (
            f'<p style="margin:0 0 8px;">{html.escape(FPS_QR_INTRO[loc])}</p>'
            '<p style="margin:0 0 16px;text-align:center;">'
            '<img src="cid:fps_qr" width="128" height="128" alt="FPS QR code" '
            'style="display:inline-block;border:0;outline:none;"/>'
            "</p>"
        )

    inner_html = (
        f"{greeting}{THANK_YOU_HTML[loc]}"
        f"{table_html}{pending_block}{fps_block}"
        f'<p style="margin:0 0 12px;">{html.escape(WHATSAPP_INTRO[loc])}</p>'
        f'<p style="margin:0;">'
        f'<a href="{esc_wa}" style="{_CTA_LINK}">WhatsApp</a>'
        f"</p>"
    )

    full_html_template = wrap_transactional_html(
        header_title=HEADER_TITLE[loc],
        inner_html=inner_html,
    )

    subject = f"{SUBJECT_PREFIX[loc]}{course_label.strip()}{SUBJECT_SUFFIX}"

    text_lines = _build_plain_text(
        loc=loc,
        labels=labels,
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


def _build_plain_text(
    *,
    loc: str,
    labels: dict[str, str],
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
    label_sep = ": " if loc == "en" else "："
    lines: list[str] = []
    if loc == "en":
        lines.append(f"Hi {full_name},\n")
    else:
        lines.append(f"您好 {full_name}，\n")
    lines.append(THANK_YOU_PLAIN[loc])
    lines.append(f"{labels['course']}{label_sep}{course_label}\n")
    if schedule_date_label and schedule_date_label.strip():
        lines.append(f"{labels['date']}{label_sep}{schedule_date_label.strip()}\n")
    if schedule_time_label and schedule_time_label.strip():
        lines.append(f"{labels['time']}{label_sep}{schedule_time_label.strip()}\n")
    lines.append(f"{labels['payment']}{label_sep}{payment_method}\n")
    lines.append(f"{labels['total']}{label_sep}{total_amount}\n\n")
    if is_pending_payment:
        lines.append(f"{PENDING_PAYMENT_NOTE[loc]}\n\n")
    if include_fps_qr_image:
        lines.append(f"{FPS_QR_INTRO[loc]}\n")
        lines.append("[FPS QR code image is attached as fps-qr.png]\n\n")
    lines.append(f"{WHATSAPP_INTRO[loc]}\n")
    if loc == "en":
        lines.append(f"WhatsApp: {whatsapp_url}\n\n")
    else:
        lines.append(f"WhatsApp：{whatsapp_url}\n\n")
    lines.append(SIGN_OFF_PLAIN[loc])
    return lines
