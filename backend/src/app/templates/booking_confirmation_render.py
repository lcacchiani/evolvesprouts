"""Render booking confirmation email bodies (MIME path with inline FPS QR image)."""

from __future__ import annotations

import html
from typing import Any

from app.templates.booking_confirmation_content import (
    CLOSING_NOTE,
    DETAILS_CONSULTATION_KIND,
    DETAILS_LEVEL_PREFIX,
    DETAILS_WRITING_FOCUS_PREFIX,
    FAQ_INTRO,
    FAQ_LINK_LABEL,
    FPS_PAYMENT_DISCLAIMER,
    FPS_QR_INTRO,
    HEADER_TITLE,
    PAYMENT_METHOD_LABELS,
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


def resolve_payment_method_display(payment_method_code: str) -> str:
    """Map reservation ``payment_method`` code to the customer-facing email label."""
    key = (payment_method_code or "").strip().lower()
    if key in PAYMENT_METHOD_LABELS:
        return PAYMENT_METHOD_LABELS[key]
    return (payment_method_code or "").strip() or "unknown"


def format_schedule_datetime_line(
    schedule_date_label: str | None,
    schedule_time_label: str | None,
) -> str | None:
    """Single schedule line: date+time, time-only, or date-only (first session rules)."""
    date_s = (schedule_date_label or "").strip()
    time_s = (schedule_time_label or "").strip()
    if date_s and time_s:
        return f"{date_s} {time_s}"
    if time_s:
        return time_s
    if date_s:
        return date_s
    return None


def _consultation_details_segments(
    *,
    loc: str,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> list[str]:
    focus = (consultation_writing_focus_label or "").strip()
    level = (consultation_level_label or "").strip()
    if not focus and not level:
        return []
    lines: list[str] = [DETAILS_CONSULTATION_KIND[loc]]
    if focus:
        lines.append(f"{DETAILS_WRITING_FOCUS_PREFIX[loc]}: {focus}")
    if level:
        lines.append(f"{DETAILS_LEVEL_PREFIX[loc]}: {level}")
    return lines


def format_consultation_details_html_cell(
    *,
    loc: str,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> str:
    segments = _consultation_details_segments(
        loc=loc,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    if not segments:
        return ""
    inner = "<br/>".join(html.escape(s) for s in segments)
    return f'<span style="display:block;text-align:right;">{inner}</span>'


def format_consultation_details_plain(
    *,
    loc: str,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> str:
    segments = _consultation_details_segments(
        loc=loc,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    if not segments:
        return ""
    return "\n".join(segments)


def booking_confirmation_template_merge_data(
    *,
    locale: str,
    full_name: str,
    course_label: str,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_name: str | None = None,
    payment_method_code: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    consultation_writing_focus_label: str | None = None,
    consultation_level_label: str | None = None,
) -> dict[str, Any]:
    """Build SES template_data (before shell merge)."""
    loc = normalize_booking_locale(locale)
    pm_display = resolve_payment_method_display(payment_method_code)
    schedule_line = format_schedule_datetime_line(
        schedule_date_label, schedule_time_label
    )
    details_html = format_consultation_details_html_cell(
        loc=loc,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    details_plain = format_consultation_details_plain(
        loc=loc,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    pm_lower = (payment_method_code or "").strip().lower()
    include_fps_instructions = pm_lower == "fps_qr" and is_pending_payment
    data: dict[str, Any] = {
        "full_name": full_name.strip(),
        "course_label": course_label.strip(),
        "payment_method": pm_display,
        "total_amount": total_amount,
        "is_pending_payment": is_pending_payment,
        "whatsapp_url": whatsapp_url.strip(),
        "include_fps_instructions": include_fps_instructions,
        "details_block_html": details_html,
        "details_plain": details_plain,
    }
    if schedule_line:
        data["schedule_datetime_label"] = schedule_line
    if location_name and location_name.strip():
        data["location_name"] = location_name.strip()
    return data


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
    location_name: str | None = None,
    payment_method_code: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    faq_url: str = "",
    include_fps_qr_image: bool,
    consultation_writing_focus_label: str | None = None,
    consultation_level_label: str | None = None,
) -> tuple[str, str, str]:
    """Return (subject, full_html, plain_text)."""
    loc = normalize_booking_locale(locale)
    labels = TABLE_LABELS[loc]
    esc_name = html.escape(full_name.strip())
    esc_course = html.escape(course_label.strip())
    pm_display = resolve_payment_method_display(payment_method_code)
    esc_pm = html.escape(pm_display)
    esc_total = html.escape(total_amount)
    esc_wa = html.escape(whatsapp_url.strip(), quote=True)

    greeting = (
        f'<p style="margin:0 0 12px;">Hi {esc_name},</p>'
        if loc == "en"
        else f'<p style="margin:0 0 12px;">您好 {esc_name}，</p>'
    )

    rows_html: list[str] = [
        _html_table_row_bordered(labels["service"], esc_course),
    ]
    schedule_line = format_schedule_datetime_line(
        schedule_date_label, schedule_time_label
    )
    if schedule_line:
        rows_html.append(
            _html_table_row_bordered(
                labels["datetime"],
                html.escape(schedule_line),
            )
        )
    details_cell = format_consultation_details_html_cell(
        loc=loc,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    if details_cell:
        rows_html.append(
            _html_table_row_bordered(labels["details"], details_cell),
        )
    if location_name and location_name.strip():
        rows_html.append(
            _html_table_row_bordered(
                labels["location"],
                html.escape(location_name.strip()),
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
            f'<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#555555;">'
            f"{html.escape(FPS_PAYMENT_DISCLAIMER[loc])}"
            "</p>"
            '<p style="margin:0 0 16px;text-align:center;">'
            '<img src="cid:fps_qr" width="128" height="128" alt="FPS QR code" '
            'style="display:inline-block;border:0;outline:none;"/>'
            "</p>"
        )

    esc_faq = html.escape(faq_url.strip(), quote=True) if faq_url else ""
    closing_note = html.escape(CLOSING_NOTE[loc])
    faq_intro_text = html.escape(FAQ_INTRO[loc])
    faq_label_text = html.escape(FAQ_LINK_LABEL[loc])
    inner_html = (
        f"{greeting}{THANK_YOU_HTML[loc]}"
        f"{table_html}{pending_block}{fps_block}"
        f'<p style="margin:0 0 16px;">{closing_note}</p>'
        f'<p style="margin:0 0 12px;">{html.escape(WHATSAPP_INTRO[loc])}</p>'
        f'<p style="margin:0 0 16px;">'
        f'<a href="{esc_wa}" style="{_CTA_LINK}">WhatsApp</a>'
        f"</p>"
    )
    if esc_faq:
        inner_html += (
            f'<p style="margin:0 0 12px;">{faq_intro_text}</p>'
            f'<p style="margin:0;">'
            f'<a href="{esc_faq}" style="{_CTA_LINK}">{faq_label_text}</a>'
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
        location_name=location_name,
        payment_method_display=pm_display,
        total_amount=total_amount,
        is_pending_payment=is_pending_payment,
        whatsapp_url=whatsapp_url.strip(),
        faq_url=faq_url.strip() if faq_url else "",
        include_fps_qr_image=include_fps_qr_image,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
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
    location_name: str | None,
    payment_method_display: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    faq_url: str,
    include_fps_qr_image: bool,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> list[str]:
    label_sep = ": " if loc == "en" else "："
    lines: list[str] = []
    if loc == "en":
        lines.append(f"Hi {full_name},\n")
    else:
        lines.append(f"您好 {full_name}，\n")
    lines.append(THANK_YOU_PLAIN[loc])
    lines.append(f"{labels['service']}{label_sep}{course_label}\n")
    schedule_line = format_schedule_datetime_line(
        schedule_date_label, schedule_time_label
    )
    if schedule_line:
        lines.append(f"{labels['datetime']}{label_sep}{schedule_line}\n")
    details_plain = format_consultation_details_plain(
        loc=loc,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    if details_plain:
        lines.append(f"{labels['details']}{label_sep}\n{details_plain}\n")
    if location_name and location_name.strip():
        lines.append(f"{labels['location']}{label_sep}{location_name.strip()}\n")
    lines.append(f"{labels['payment']}{label_sep}{payment_method_display}\n")
    lines.append(f"{labels['total']}{label_sep}{total_amount}\n\n")
    if is_pending_payment:
        lines.append(f"{PENDING_PAYMENT_NOTE[loc]}\n\n")
    if include_fps_qr_image:
        lines.append(f"{FPS_QR_INTRO[loc]}\n")
        lines.append(f"{FPS_PAYMENT_DISCLAIMER[loc]}\n")
        lines.append("[FPS QR code image is attached as fps-qr.png]\n\n")
    lines.append(f"{CLOSING_NOTE[loc]}\n\n")
    lines.append(f"{WHATSAPP_INTRO[loc]}\n")
    if loc == "en":
        lines.append(f"WhatsApp: {whatsapp_url}\n\n")
    else:
        lines.append(f"WhatsApp：{whatsapp_url}\n\n")
    if faq_url:
        lines.append(f"{FAQ_INTRO[loc]}\n")
        if loc == "en":
            lines.append(f"FAQ: {faq_url}\n\n")
        else:
            lines.append(f"{FAQ_LINK_LABEL[loc]}：{faq_url}\n\n")
    lines.append(SIGN_OFF_PLAIN[loc])
    return lines
