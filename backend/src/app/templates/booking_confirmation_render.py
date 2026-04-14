"""Render booking confirmation email bodies (MIME path with inline FPS QR image)."""

from __future__ import annotations

import hashlib
import html
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.templates.booking_confirmation_content import (
    BOOKING_ICS_ATTACHED_NOTE,
    BOOKING_ICS_PRODID,
    CLOSING_NOTE,
    DETAILS_AGE_GROUP_PREFIX,
    DETAILS_COHORT_PREFIX,
    DETAILS_LEVEL_PREFIX,
    DETAILS_WRITING_FOCUS_PREFIX,
    FAQ_LINK_LABEL,
    FPS_PAYMENT_DISCLAIMER,
    FPS_QR_INTRO,
    HEADER_TITLE,
    PAYMENT_METHOD_LABELS,
    PENDING_PAYMENT_NOTE,
    QUESTIONS_LINE_HTML_MIDDLE,
    QUESTIONS_LINE_HTML_PREFIX,
    QUESTIONS_LINE_HTML_SUFFIX,
    QUESTIONS_LINE_PLAIN,
    SIGN_OFF_PLAIN,
    SUBJECT_PREFIX,
    SUBJECT_SUFFIX,
    TABLE_LABELS,
    THANK_YOU_HTML,
    THANK_YOU_PLAIN,
    WHATSAPP_LINK_LABEL,
    normalize_booking_locale,
)
from app.templates.ses.email_shell import wrap_transactional_html

_CTA_LINK = "color:#C84A16;font-weight:600;"

_HK_LOCATION_MARKERS = (
    "hong kong",
    "hk",
    "h.k.",
    "香港",
    "kowloon",
    "九龍",
    "九龙",
    "new territories",
    "新界",
    "sheung wan",
    "上環",
    "上环",
    "wan chai",
    "灣仔",
    "湾仔",
    "central",
    "中環",
    "中环",
    "admiralty",
    "金鐘",
    "金钟",
    "causeway bay",
    "銅鑼灣",
    "铜锣湾",
    "mid-levels",
    "半山",
    "shek tong tsui",
    "石塘咀",
    "pacific place",
    "太古廣場",
    "太古广场",
)

_EMAIL_HKT_TZ = ZoneInfo("Asia/Hong_Kong")
_ICS_LINE_MAX = 75
_UID_HASH_SUFFIX = "@evolvesprouts.com"


def _escape_ical_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def _fold_ical_line(line: str, max_len: int = _ICS_LINE_MAX) -> str:
    if len(line) <= max_len:
        return line
    parts: list[str] = []
    rest = line
    while len(rest) > max_len:
        parts.append(rest[:max_len])
        rest = " " + rest[max_len:]
    if rest:
        parts.append(rest)
    return "\r\n".join(parts)


def _push_ical_property(lines: list[str], name: str, value: str) -> None:
    escaped = _escape_ical_text(value)
    folded = _fold_ical_line(f"{name}:{escaped}")
    lines.extend(folded.split("\r\n"))


def _parse_iso_to_utc_datetime(value: str | None) -> datetime | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_EMAIL_HKT_TZ)
    return dt.astimezone(timezone.utc)


def _format_ics_utc(dt: datetime) -> str:
    utc = dt.astimezone(timezone.utc)
    return utc.strftime("%Y%m%dT%H%M%SZ")


def _parse_end_iso_from_schedule_time_label(
    schedule_time_label: str | None,
) -> str | None:
    s = (schedule_time_label or "").strip()
    if " – " not in s:
        return None
    second = s.split(" – ", 1)[1].strip()
    if not second:
        return None
    if "T" in second or second.endswith("Z"):
        return second
    return None


def build_booking_confirmation_ics(
    *,
    course_label: str,
    primary_session_iso: str | None,
    schedule_time_label: str | None = None,
    location_line: str | None = None,
) -> bytes | None:
    """Build a single-event UTF-8 .ics for the primary session, or None if no start ISO."""
    start_dt = _parse_iso_to_utc_datetime(primary_session_iso)
    if start_dt is None:
        return None

    end_iso = _parse_end_iso_from_schedule_time_label(schedule_time_label)
    end_dt = _parse_iso_to_utc_datetime(end_iso) if end_iso else None
    if end_dt is None or end_dt <= start_dt:
        end_dt = start_dt + timedelta(hours=1)

    summary = (course_label or "").strip() or "Booking"
    location = (location_line or "").strip()

    uid_seed = "|".join(
        [
            summary,
            (primary_session_iso or "").strip(),
            location,
        ]
    )
    uid_body = hashlib.sha256(uid_seed.encode("utf-8")).hexdigest()
    uid = f"{uid_body}{_UID_HASH_SUFFIX}"

    stamp = _format_ics_utc(datetime.now(timezone.utc))
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{BOOKING_ICS_PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{stamp}",
        f"DTSTART:{_format_ics_utc(start_dt)}",
        f"DTEND:{_format_ics_utc(end_dt)}",
    ]
    _push_ical_property(lines, "SUMMARY", summary)
    if location:
        _push_ical_property(lines, "LOCATION", location)
    lines.extend(["END:VEVENT", "END:VCALENDAR"])
    return ("\r\n".join(lines) + "\r\n").encode("utf-8")


_MONTH_NAMES_EN = (
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


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


def _normalize_location_match_text(*parts: str | None) -> str:
    return " ".join((p or "").strip().lower() for p in parts if (p or "").strip())


def location_suggests_hong_kong(
    *,
    location_name: str | None,
    location_address: str | None,
) -> bool:
    """Heuristic: venue/address text indicates a Hong Kong location."""
    blob = _normalize_location_match_text(location_name, location_address)
    if not blob:
        return False
    return any(marker in blob for marker in _HK_LOCATION_MARKERS)


def format_booking_location_display_line(
    *,
    location_name: str | None,
    location_address: str | None,
) -> str | None:
    """Venue + comma + address when both exist; otherwise whichever is set."""
    name = (location_name or "").strip()
    addr = (location_address or "").strip()
    if name and addr:
        if name.lower() == addr.lower():
            return name
        return f"{name}, {addr}"
    if name:
        return name
    if addr:
        return addr
    return None


def _parse_iso_datetime(value: str | None) -> datetime | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=_EMAIL_HKT_TZ)
    return dt


def _format_hkt_email_line(dt: datetime) -> str:
    """e.g. ``16 April @ 18:00 HKT`` (24-hour clock, Asia/Hong_Kong)."""
    local = dt.astimezone(_EMAIL_HKT_TZ)
    day = local.day
    month = _MONTH_NAMES_EN[local.month]
    hm = f"{local.hour:02d}:{local.minute:02d}"
    return f"{day} {month} @ {hm} HKT"


def format_booking_datetime_display(
    *,
    primary_session_iso: str | None,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_use_hkt: bool,
) -> str | None:
    """Schedule line for email; HKT formatting when the booking is in Hong Kong."""
    if location_use_hkt:
        parsed = _parse_iso_datetime(primary_session_iso)
        if parsed is not None:
            return _format_hkt_email_line(parsed)
        line = format_schedule_datetime_line(schedule_date_label, schedule_time_label)
        if not line:
            return None
        if "hkt" not in line.lower():
            return f"{line} HKT"
        return line
    return format_schedule_datetime_line(schedule_date_label, schedule_time_label)


def _normalize_course_slug(course_slug: str | None) -> str:
    return (course_slug or "").strip().lower()


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
    lines: list[str] = []
    if focus:
        lines.append(f"{DETAILS_WRITING_FOCUS_PREFIX[loc]}: {focus}")
    if level:
        lines.append(f"{DETAILS_LEVEL_PREFIX[loc]}: {level}")
    return lines


def _my_best_auntie_details_segments(
    *,
    loc: str,
    cohort_label: str | None,
    age_group_label: str | None,
) -> list[str]:
    cohort = (cohort_label or "").strip()
    age = (age_group_label or "").strip()
    if not cohort and not age:
        return []
    lines: list[str] = []
    if cohort:
        lines.append(f"{DETAILS_COHORT_PREFIX[loc]}: {cohort}")
    if age:
        lines.append(f"{DETAILS_AGE_GROUP_PREFIX[loc]}: {age}")
    return lines


def _cohort_label_for_mba_details(
    course_slug: str | None,
    schedule_date_label: str | None,
) -> str | None:
    if _normalize_course_slug(course_slug) != "my-best-auntie":
        return None
    s = (schedule_date_label or "").strip()
    return s or None


def format_booking_details_html_cell(
    *,
    loc: str,
    course_slug: str | None,
    schedule_date_label: str | None,
    age_group_label: str | None,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> str:
    slug = _normalize_course_slug(course_slug)
    cohort_for_mba = _cohort_label_for_mba_details(course_slug, schedule_date_label)
    if slug == "my-best-auntie":
        segments = _my_best_auntie_details_segments(
            loc=loc,
            cohort_label=cohort_for_mba,
            age_group_label=age_group_label,
        )
    elif slug == "consultation-booking":
        segments = _consultation_details_segments(
            loc=loc,
            consultation_writing_focus_label=consultation_writing_focus_label,
            consultation_level_label=consultation_level_label,
        )
    else:
        segments = []
    if not segments:
        return ""
    inner = "<br/>".join(html.escape(s) for s in segments)
    return f'<span style="display:block;text-align:right;">{inner}</span>'


def format_booking_details_plain(
    *,
    loc: str,
    course_slug: str | None,
    schedule_date_label: str | None,
    age_group_label: str | None,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> str:
    slug = _normalize_course_slug(course_slug)
    cohort_for_mba = _cohort_label_for_mba_details(course_slug, schedule_date_label)
    if slug == "my-best-auntie":
        segments = _my_best_auntie_details_segments(
            loc=loc,
            cohort_label=cohort_for_mba,
            age_group_label=age_group_label,
        )
    elif slug == "consultation-booking":
        segments = _consultation_details_segments(
            loc=loc,
            consultation_writing_focus_label=consultation_writing_focus_label,
            consultation_level_label=consultation_level_label,
        )
    else:
        segments = []
    if not segments:
        return ""
    return "\n".join(segments)


def format_consultation_details_html_cell(
    *,
    loc: str,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> str:
    """Backward-compatible alias for consultation-only formatting."""
    return format_booking_details_html_cell(
        loc=loc,
        course_slug="consultation-booking",
        schedule_date_label=None,
        age_group_label=None,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )


def format_consultation_details_plain(
    *,
    loc: str,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
) -> str:
    return format_booking_details_plain(
        loc=loc,
        course_slug="consultation-booking",
        schedule_date_label=None,
        age_group_label=None,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )


def _questions_line_html(loc: str, esc_wa: str, esc_faq: str) -> str:
    return (
        f'<p style="margin:0;">{html.escape(QUESTIONS_LINE_HTML_PREFIX[loc])}'
        f'<a href="{esc_wa}" style="{_CTA_LINK}">'
        f"{html.escape(WHATSAPP_LINK_LABEL[loc])}</a>"
        f"{html.escape(QUESTIONS_LINE_HTML_MIDDLE[loc])}"
        f'<a href="{esc_faq}" style="{_CTA_LINK}">'
        f"{html.escape(FAQ_LINK_LABEL[loc])}</a>"
        f"{html.escape(QUESTIONS_LINE_HTML_SUFFIX[loc])}</p>"
    )


def _questions_line_plain(loc: str, whatsapp_url: str, faq_url: str) -> str:
    return QUESTIONS_LINE_PLAIN[loc].format(
        whatsapp_url=whatsapp_url,
        faq_url=faq_url,
    )


def booking_confirmation_template_merge_data(
    *,
    locale: str,
    full_name: str,
    course_label: str,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_name: str | None = None,
    location_address: str | None = None,
    primary_session_iso: str | None = None,
    course_slug: str | None = None,
    age_group_label: str | None = None,
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
    loc_line = format_booking_location_display_line(
        location_name=location_name,
        location_address=location_address,
    )
    use_hkt = location_suggests_hong_kong(
        location_name=location_name,
        location_address=location_address,
    )
    schedule_line = format_booking_datetime_display(
        primary_session_iso=primary_session_iso,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_use_hkt=use_hkt,
    )
    details_html = format_booking_details_html_cell(
        loc=loc,
        course_slug=course_slug,
        schedule_date_label=schedule_date_label,
        age_group_label=age_group_label,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    details_plain = format_booking_details_plain(
        loc=loc,
        course_slug=course_slug,
        schedule_date_label=schedule_date_label,
        age_group_label=age_group_label,
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
    if loc_line:
        data["location_name"] = loc_line
    iso_set = bool((primary_session_iso or "").strip())
    data["include_calendar_fallback_hint"] = bool(schedule_line) and not iso_set
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
    location_address: str | None = None,
    primary_session_iso: str | None = None,
    course_slug: str | None = None,
    age_group_label: str | None = None,
    payment_method_code: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    faq_url: str = "",
    include_fps_qr_image: bool,
    consultation_writing_focus_label: str | None = None,
    consultation_level_label: str | None = None,
    attach_calendar_invite_ics: bool = False,
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
    esc_faq = html.escape(faq_url.strip(), quote=True) if faq_url.strip() else ""

    greeting = (
        f'<p style="margin:0 0 12px;">Hi {esc_name},</p>'
        if loc == "en"
        else f'<p style="margin:0 0 12px;">您好 {esc_name}，</p>'
    )

    loc_line = format_booking_location_display_line(
        location_name=location_name,
        location_address=location_address,
    )
    use_hkt = location_suggests_hong_kong(
        location_name=location_name,
        location_address=location_address,
    )
    schedule_line = format_booking_datetime_display(
        primary_session_iso=primary_session_iso,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_use_hkt=use_hkt,
    )

    rows_html: list[str] = [
        _html_table_row_bordered(labels["service"], esc_course),
    ]
    details_cell = format_booking_details_html_cell(
        loc=loc,
        course_slug=course_slug,
        schedule_date_label=schedule_date_label,
        age_group_label=age_group_label,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    if details_cell:
        rows_html.append(
            _html_table_row_bordered(labels["details"], details_cell),
        )
    if schedule_line:
        rows_html.append(
            _html_table_row_bordered(
                labels["datetime"],
                html.escape(schedule_line),
            )
        )
    if loc_line:
        rows_html.append(
            _html_table_row_bordered(
                labels["location"],
                html.escape(loc_line),
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

    ics_note_html = ""
    if attach_calendar_invite_ics:
        ics_note_html = (
            '<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333333;">'
            f"{html.escape(BOOKING_ICS_ATTACHED_NOTE[loc])}"
            "</p>"
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

    closing_note = html.escape(CLOSING_NOTE[loc])
    questions_html = _questions_line_html(loc, esc_wa, esc_faq) if esc_faq else ""
    inner_html = (
        f"{greeting}{THANK_YOU_HTML[loc]}"
        f"{table_html}{ics_note_html}{pending_block}{fps_block}"
        '<hr style="border:0;border-top:1px solid #eeeeee;margin:0 0 16px;"/>'
        f'<p style="margin:0 0 16px;">{closing_note}</p>'
        f"{questions_html}"
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
        location_address=location_address,
        primary_session_iso=primary_session_iso,
        course_slug=course_slug,
        age_group_label=age_group_label,
        payment_method_display=pm_display,
        total_amount=total_amount,
        is_pending_payment=is_pending_payment,
        whatsapp_url=whatsapp_url.strip(),
        faq_url=faq_url.strip() if faq_url else "",
        include_fps_qr_image=include_fps_qr_image,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
        attach_calendar_invite_ics=attach_calendar_invite_ics,
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
    location_address: str | None,
    primary_session_iso: str | None,
    course_slug: str | None,
    age_group_label: str | None,
    payment_method_display: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    faq_url: str,
    include_fps_qr_image: bool,
    consultation_writing_focus_label: str | None,
    consultation_level_label: str | None,
    attach_calendar_invite_ics: bool,
) -> list[str]:
    label_sep = ": " if loc == "en" else "："
    lines: list[str] = []
    if loc == "en":
        lines.append(f"Hi {full_name},\n")
    else:
        lines.append(f"您好 {full_name}，\n")
    lines.append(THANK_YOU_PLAIN[loc])
    lines.append(f"{labels['service']}{label_sep}{course_label}\n")

    details_plain = format_booking_details_plain(
        loc=loc,
        course_slug=course_slug,
        schedule_date_label=schedule_date_label,
        age_group_label=age_group_label,
        consultation_writing_focus_label=consultation_writing_focus_label,
        consultation_level_label=consultation_level_label,
    )
    if details_plain:
        lines.append(f"{labels['details']}{label_sep}\n{details_plain}\n")

    use_hkt = location_suggests_hong_kong(
        location_name=location_name,
        location_address=location_address,
    )
    schedule_line = format_booking_datetime_display(
        primary_session_iso=primary_session_iso,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_use_hkt=use_hkt,
    )
    if schedule_line:
        lines.append(f"{labels['datetime']}{label_sep}{schedule_line}\n")

    loc_line = format_booking_location_display_line(
        location_name=location_name,
        location_address=location_address,
    )
    if loc_line:
        lines.append(f"{labels['location']}{label_sep}{loc_line}\n")

    lines.append(f"{labels['payment']}{label_sep}{payment_method_display}\n")
    lines.append(f"{labels['total']}{label_sep}{total_amount}\n\n")
    if attach_calendar_invite_ics:
        lines.append(f"{BOOKING_ICS_ATTACHED_NOTE[loc]}\n\n")
    if is_pending_payment:
        lines.append(f"{PENDING_PAYMENT_NOTE[loc]}\n\n")
    if include_fps_qr_image:
        lines.append(f"{FPS_QR_INTRO[loc]}\n")
        lines.append(f"{FPS_PAYMENT_DISCLAIMER[loc]}\n")
        lines.append("[FPS QR code image is attached as fps-qr.png]\n\n")
    lines.append(f"{CLOSING_NOTE[loc]}\n\n")
    if faq_url:
        lines.append(
            _questions_line_plain(loc, whatsapp_url=whatsapp_url, faq_url=faq_url)
            + "\n\n"
        )
    lines.append(SIGN_OFF_PLAIN[loc])
    return lines
