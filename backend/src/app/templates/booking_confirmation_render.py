"""Render booking confirmation email bodies (MIME path with inline FPS QR image)."""

from __future__ import annotations

import hashlib
import html
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.templates.booking_confirmation_content import (
    BOOKING_CALENDAR_SES_FALLBACK_HINT,
    BOOKING_ICS_ATTACHED_NOTE,
    BOOKING_ICS_PRODID,
    CLOSING_NOTE,
    DETAILS_AGE_GROUP_PREFIX,
    DETAILS_COHORT_PREFIX,
    DETAILS_LEVEL_PREFIX,
    DETAILS_WRITING_FOCUS_PREFIX,
    DIRECTIONS_LINK_LABEL,
    FAQ_LINK_LABEL,
    FPS_PAYMENT_DISCLAIMER,
    FREE_TOTAL_LABEL,
    FPS_QR_INTRO,
    GROUP_SESSION_LABEL_TEMPLATE,
    HEADER_TITLE,
    PAYMENT_METHOD_LABELS,
    PENDING_PAYMENT_NOTE,
    SESSION_ORDINAL_LABELS,
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
    resolve_service_row_label,
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


def _utf8_prefix_end_index(text: str, max_octets: int) -> int:
    """Largest end index such that text[:end].encode('utf-8') fits in max_octets."""
    if max_octets <= 0:
        return 0
    lo, hi = 0, len(text)
    best = 0
    while lo <= hi:
        mid = (lo + hi) // 2
        if len(text[:mid].encode("utf-8")) <= max_octets:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def _fold_ical_line(line: str, max_octets: int = _ICS_LINE_MAX) -> str:
    """Fold at UTF-8 octet boundaries (RFC 5545 section 3.1: 75 octets per physical line)."""
    if len(line.encode("utf-8")) <= max_octets:
        return line
    parts: list[str] = []
    rest = line
    while len(rest.encode("utf-8")) > max_octets:
        cut = _utf8_prefix_end_index(rest, max_octets)
        if cut == 0:
            cut = 1
        parts.append(rest[:cut])
        rest = " " + rest[cut:]
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


def build_booking_confirmation_ics(
    *,
    course_label: str,
    primary_session_iso: str | None,
    primary_session_end_iso: str | None = None,
    location_line: str | None = None,
    course_slug: str | None = None,
) -> bytes | None:
    """Build a single-event UTF-8 .ics for the primary session, or None if no start ISO."""
    if _normalize_course_slug(course_slug) == "consultation-booking":
        return None

    start_dt = _parse_iso_to_utc_datetime(primary_session_iso)
    if start_dt is None:
        return None

    end_dt = _parse_iso_to_utc_datetime(primary_session_end_iso)
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
    ]
    _push_ical_property(lines, "UID", uid)
    lines.extend(
        [
            f"DTSTAMP:{stamp}",
            f"DTSTART:{_format_ics_utc(start_dt)}",
            f"DTEND:{_format_ics_utc(end_dt)}",
        ]
    )
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


def _format_hkt_part_date_email(dt: datetime) -> str:
    """e.g. ``16 April`` (month name in English, Asia/Hong_Kong)."""
    local = dt.astimezone(_EMAIL_HKT_TZ)
    day = local.day
    month = _MONTH_NAMES_EN[local.month]
    return f"{day} {month}"


def _format_hkt_time_email(dt: datetime) -> str:
    """24-hour ``HH:MM`` in Asia/Hong_Kong."""
    local = dt.astimezone(_EMAIL_HKT_TZ)
    return f"{local.hour:02d}:{local.minute:02d}"


def _hkt_consultation_day_part_label(dt: datetime, loc: str) -> str:
    """Consultation slot wording: English uses phrases; zh locales keep AM/PM."""
    local = dt.astimezone(_EMAIL_HKT_TZ)
    is_morning = local.hour < 12
    if loc == "en":
        return "in the morning" if is_morning else "in the afternoon"
    return "AM" if is_morning else "PM"


def _format_hkt_email_line_no_tz_suffix(dt: datetime) -> str:
    """e.g. ``16 April @ 18:00`` (for MBA modal parity; email adds HKT per line)."""
    local = dt.astimezone(_EMAIL_HKT_TZ)
    day = local.day
    month = _MONTH_NAMES_EN[local.month]
    hm = _format_hkt_time_email(dt)
    return f"{day} {month} @ {hm}"


def _normalize_http_location_url(value: str | None) -> str | None:
    s = (value or "").strip()
    if not s:
        return None
    lower = s.lower()
    if lower.startswith("https://") or lower.startswith("http://"):
        return s
    return None


def format_booking_datetime_display_multi(
    *,
    course_slug: str | None,
    course_sessions: list[dict[str, str]] | None,
    primary_session_iso: str | None,
    primary_session_end_iso: str | None,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_use_hkt: bool,
    locale: str,
) -> tuple[str | None, str | None]:
    """Return (schedule_html, schedule_plain); lines joined with <br/> / newlines."""
    loc = normalize_booking_locale(locale)
    slug = _normalize_course_slug(course_slug)
    sessions = list(course_sessions or [])
    plain_lines: list[str] = []

    if (
        slug == "my-best-auntie"
        and not sessions
        and (primary_session_iso or "").strip()
    ):
        end = (primary_session_end_iso or "").strip()
        sessions = [
            {
                "start_iso": (primary_session_iso or "").strip(),
                **({"end_iso": end} if end else {}),
            }
        ]

    if slug == "my-best-auntie" and sessions:
        template = GROUP_SESSION_LABEL_TEMPLATE.get(
            loc, GROUP_SESSION_LABEL_TEMPLATE["en"]
        )
        ordinals = SESSION_ORDINAL_LABELS.get(loc, SESSION_ORDINAL_LABELS["en"])
        for idx, row in enumerate(sessions):
            start_raw = (row.get("start_iso") or "").strip()
            if not start_raw:
                continue
            parsed = _parse_iso_datetime(start_raw)
            if parsed is None:
                continue
            ordinal = ordinals[idx] if idx < len(ordinals) else str(idx + 1)
            part = _format_hkt_email_line_no_tz_suffix(parsed)
            if location_use_hkt:
                part = f"{part} HKT"
            plain_lines.append(
                template.format(ordinal=ordinal, dateTime=part),
            )
    elif slug == "consultation-booking":
        start_raw = (primary_session_iso or "").strip()
        if not start_raw and sessions:
            start_raw = (sessions[0].get("start_iso") or "").strip()
        parsed = _parse_iso_datetime(start_raw) if start_raw else None
        if parsed is not None:
            date_part = _format_hkt_part_date_email(parsed)
            am_pm = _hkt_consultation_day_part_label(parsed, loc)
            plain_lines.append(f"{date_part} {am_pm}")
    else:
        # Events and other flows: all course_sessions when present, else primary only
        event_sessions = sessions if sessions else []
        if not event_sessions and (primary_session_iso or "").strip():
            event_sessions = [{"start_iso": (primary_session_iso or "").strip()}]
        if event_sessions:
            for row in event_sessions:
                start_raw = (row.get("start_iso") or "").strip()
                if not start_raw:
                    continue
                parsed = _parse_iso_datetime(start_raw)
                if parsed is not None and location_use_hkt:
                    plain_lines.append(_format_hkt_email_line(parsed))
                else:
                    one = format_booking_datetime_display(
                        primary_session_iso=start_raw,
                        schedule_date_label=None,
                        schedule_time_label=None,
                        location_use_hkt=location_use_hkt,
                    )
                    if one:
                        plain_lines.append(one)
                    elif parsed is not None:
                        plain_lines.append(_format_hkt_email_line(parsed))
        else:
            fallback = format_booking_datetime_display(
                primary_session_iso=primary_session_iso,
                schedule_date_label=schedule_date_label,
                schedule_time_label=schedule_time_label,
                location_use_hkt=location_use_hkt,
            )
            if fallback:
                plain_lines.append(fallback)

    if not plain_lines:
        return None, None

    esc = [html.escape(line) for line in plain_lines]
    return "<br/>".join(esc), "\n".join(plain_lines)


def format_booking_location_html_cell(
    *,
    loc: str,
    location_name: str | None,
    location_address: str | None,
    location_url: str | None,
) -> str:
    """Location <td> inner HTML: venue and address on separate lines + optional directions link."""
    name = (location_name or "").strip()
    addr = (location_address or "").strip()
    if not name and not addr:
        return ""

    blocks: list[str] = []
    if name and addr:
        if name.lower() == addr.lower():
            blocks.append(
                f'<span style="display:block;text-align:right;">{html.escape(name)}</span>'
            )
        else:
            blocks.append(
                f'<span style="display:block;text-align:right;">{html.escape(name)}</span>'
            )
            blocks.append(
                '<span style="display:block;text-align:right;margin-top:4px;">'
                f"{html.escape(addr)}</span>"
            )
    elif name:
        blocks.append(
            f'<span style="display:block;text-align:right;">{html.escape(name)}</span>'
        )
    else:
        blocks.append(
            f'<span style="display:block;text-align:right;">{html.escape(addr)}</span>'
        )

    body = "".join(blocks)
    safe_url = _normalize_http_location_url(location_url)
    if not safe_url:
        return body
    esc_href = html.escape(safe_url, quote=True)
    link_label = html.escape(
        DIRECTIONS_LINK_LABEL.get(loc, DIRECTIONS_LINK_LABEL["en"])
    )
    link = f'<a href="{esc_href}" style="{_CTA_LINK}">{link_label}</a>'
    return f"{body}<br/>{link}"


def format_booking_location_plain_block(
    *,
    loc: str,
    location_name: str | None,
    location_address: str | None,
    location_url: str | None,
) -> str:
    name = (location_name or "").strip()
    addr = (location_address or "").strip()
    lines: list[str] = []
    if name and addr:
        if name.lower() == addr.lower():
            lines.append(name)
        else:
            lines.append(name)
            lines.append(addr)
    elif name:
        lines.append(name)
    elif addr:
        lines.append(addr)
    else:
        return ""
    safe_url = _normalize_http_location_url(location_url)
    label = DIRECTIONS_LINK_LABEL.get(loc, DIRECTIONS_LINK_LABEL["en"])
    if safe_url:
        lines.append(f"{label}: {safe_url}")
    return "\n".join(lines)


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
    service_slug: str | None = None,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_name: str | None = None,
    location_address: str | None = None,
    primary_session_iso: str | None = None,
    primary_session_end_iso: str | None = None,
    course_slug: str | None = None,
    age_group_label: str | None = None,
    payment_method_code: str,
    total_amount: str,
    is_pending_payment: bool,
    whatsapp_url: str,
    consultation_writing_focus_label: str | None = None,
    consultation_level_label: str | None = None,
    course_sessions: list[dict[str, str]] | None = None,
    location_url: str | None = None,
    is_free: bool = False,
) -> dict[str, Any]:
    """Build SES template_data (before shell merge)."""
    loc = normalize_booking_locale(locale)
    service_row_label = resolve_service_row_label(loc, service_slug, course_label)
    pm_display = resolve_payment_method_display(payment_method_code)
    use_hkt = location_suggests_hong_kong(
        location_name=location_name,
        location_address=location_address,
    )
    schedule_html, schedule_plain = format_booking_datetime_display_multi(
        course_slug=course_slug,
        course_sessions=course_sessions,
        primary_session_iso=primary_session_iso,
        primary_session_end_iso=primary_session_end_iso,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_use_hkt=use_hkt,
        locale=loc,
    )
    loc_cell_html = format_booking_location_html_cell(
        loc=loc,
        location_name=location_name,
        location_address=location_address,
        location_url=location_url,
    )
    loc_plain_block = format_booking_location_plain_block(
        loc=loc,
        location_name=location_name,
        location_address=location_address,
        location_url=location_url,
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
    pending_for_template = False if is_free else is_pending_payment
    include_fps_instructions = (
        not is_free and pm_lower == "fps_qr" and is_pending_payment
    )
    free_label = FREE_TOTAL_LABEL[loc]
    data: dict[str, Any] = {
        "full_name": full_name.strip(),
        "course_label": course_label.strip(),
        "service_row_label": service_row_label,
        "total_amount": free_label if is_free else total_amount,
        "is_pending_payment": pending_for_template,
        "is_free": is_free,
        "free_total_label": free_label,
        "whatsapp_url": whatsapp_url.strip(),
        "include_fps_instructions": include_fps_instructions,
        "details_block_html": details_html,
        "details_plain": details_plain,
    }
    if not is_free:
        data["payment_method"] = pm_display
    if schedule_html:
        data["schedule_datetime_label_html"] = schedule_html
    if schedule_plain:
        data["schedule_datetime_plain"] = schedule_plain
        if "\n" in schedule_plain:
            data["schedule_datetime_plain_multiline"] = True
    if loc_cell_html:
        data["location_block_html"] = loc_cell_html
    if loc_plain_block:
        data["location_plain"] = loc_plain_block
        if "\n" in loc_plain_block:
            data["location_plain_multiline"] = True
    safe_location_url = _normalize_http_location_url(location_url)
    if safe_location_url:
        data["location_url"] = safe_location_url
    iso_set = bool((primary_session_iso or "").strip())
    # Calendar reminder sits under the Date & time row in SES HTML; MIME path uses the same layout.
    data["include_calendar_fallback_hint_html"] = bool(schedule_html) and not iso_set
    data["include_calendar_fallback_hint_plain"] = bool(schedule_plain) and not iso_set
    data["include_calendar_note_after_schedule_html"] = False
    data["include_calendar_note_after_schedule_plain"] = False
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
    service_slug: str | None = None,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_name: str | None = None,
    location_address: str | None = None,
    primary_session_iso: str | None = None,
    primary_session_end_iso: str | None = None,
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
    course_sessions: list[dict[str, str]] | None = None,
    location_url: str | None = None,
    is_free: bool = False,
) -> tuple[str, str, str]:
    """Return (subject, full_html, plain_text)."""
    loc = normalize_booking_locale(locale)
    labels = TABLE_LABELS[loc]
    esc_name = html.escape(full_name.strip())
    esc_course = html.escape(course_label.strip())
    service_row_label = resolve_service_row_label(loc, service_slug, course_label)
    esc_service_row = html.escape(service_row_label)
    pm_display = resolve_payment_method_display(payment_method_code)
    esc_pm = html.escape(pm_display)
    free_label = FREE_TOTAL_LABEL[loc]
    esc_total = html.escape(free_label if is_free else total_amount)
    esc_wa = html.escape(whatsapp_url.strip(), quote=True)
    esc_faq = html.escape(faq_url.strip(), quote=True) if faq_url.strip() else ""

    greeting = (
        f'<p style="margin:0 0 12px;">Hi {esc_name},</p>'
        if loc == "en"
        else f'<p style="margin:0 0 12px;">您好 {esc_name}，</p>'
    )

    use_hkt = location_suggests_hong_kong(
        location_name=location_name,
        location_address=location_address,
    )
    schedule_html, _schedule_plain_preview = format_booking_datetime_display_multi(
        course_slug=course_slug,
        course_sessions=course_sessions,
        primary_session_iso=primary_session_iso,
        primary_session_end_iso=primary_session_end_iso,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_use_hkt=use_hkt,
        locale=loc,
    )

    rows_html: list[str] = [
        _html_table_row_bordered(labels["service"], esc_service_row),
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
    if schedule_html:
        iso_set = bool((primary_session_iso or "").strip())
        datetime_value = (
            f'<span style="display:block;text-align:right;">{schedule_html}</span>'
        )
        if attach_calendar_invite_ics:
            datetime_value += (
                '<p style="margin:12px 0 0;font-size:14px;line-height:1.5;'
                'color:#333333;text-align:right;">'
                f"{html.escape(BOOKING_ICS_ATTACHED_NOTE[loc])}"
                "</p>"
            )
        elif not iso_set:
            datetime_value += (
                '<p style="margin:12px 0 0;font-size:14px;line-height:1.5;'
                'color:#333333;text-align:right;">'
                f"{html.escape(BOOKING_CALENDAR_SES_FALLBACK_HINT[loc])}"
                "</p>"
            )
        rows_html.append(
            _html_table_row_bordered(
                labels["datetime"],
                datetime_value,
            )
        )
    loc_cell_html = format_booking_location_html_cell(
        loc=loc,
        location_name=location_name,
        location_address=location_address,
        location_url=location_url,
    )
    if loc_cell_html:
        rows_html.append(
            _html_table_row_bordered(
                labels["location"],
                loc_cell_html,
            )
        )
    if not is_free:
        rows_html.append(_html_table_row_bordered(labels["payment"], esc_pm))
    total_cell_html = (
        f'<span style="color:#2C6C25;font-weight:600;">{html.escape(free_label)}</span>'
        if is_free
        else esc_total
    )
    rows_html.append(_html_table_row_final(labels["total"], total_cell_html))

    table_html = (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;margin:0 0 16px;">'
        + "".join(rows_html)
        + "</table>"
    )

    pending_block = ""
    if not is_free and is_pending_payment:
        pending_block = (
            '<p style="margin:0 0 16px;padding:12px;background:#fff8e6;'
            'border-radius:8px;color:#5c4a00;">'
            f"{html.escape(PENDING_PAYMENT_NOTE[loc])}"
            "</p>"
        )

    fps_block = ""
    if not is_free and include_fps_qr_image:
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
        f"{table_html}{pending_block}{fps_block}"
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
        service_row_label=service_row_label,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_name=location_name,
        location_address=location_address,
        primary_session_iso=primary_session_iso,
        primary_session_end_iso=primary_session_end_iso,
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
        course_sessions=course_sessions,
        location_url=location_url,
        is_free=is_free,
        free_total_label=free_label,
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
    service_row_label: str,
    schedule_date_label: str | None,
    schedule_time_label: str | None,
    location_name: str | None,
    location_address: str | None,
    primary_session_iso: str | None,
    primary_session_end_iso: str | None,
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
    course_sessions: list[dict[str, str]] | None,
    location_url: str | None,
    is_free: bool = False,
    free_total_label: str = "",
) -> list[str]:
    label_sep = ": " if loc == "en" else "："
    lines: list[str] = []
    if loc == "en":
        lines.append(f"Hi {full_name},\n")
    else:
        lines.append(f"您好 {full_name}，\n")
    lines.append(THANK_YOU_PLAIN[loc])
    lines.append(f"{labels['service']}{label_sep}{service_row_label}\n")

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
    _schedule_html, schedule_plain = format_booking_datetime_display_multi(
        course_slug=course_slug,
        course_sessions=course_sessions,
        primary_session_iso=primary_session_iso,
        primary_session_end_iso=primary_session_end_iso,
        schedule_date_label=schedule_date_label,
        schedule_time_label=schedule_time_label,
        location_use_hkt=use_hkt,
        locale=loc,
    )
    if schedule_plain:
        lines.append(f"{labels['datetime']}{label_sep}\n{schedule_plain}\n")
        iso_set = bool((primary_session_iso or "").strip())
        if attach_calendar_invite_ics:
            lines.append(f"{BOOKING_ICS_ATTACHED_NOTE[loc]}\n\n")
        elif not iso_set:
            lines.append(f"{BOOKING_CALENDAR_SES_FALLBACK_HINT[loc]}\n\n")

    loc_plain_block = format_booking_location_plain_block(
        loc=loc,
        location_name=location_name,
        location_address=location_address,
        location_url=location_url,
    )
    if loc_plain_block:
        lines.append(f"{labels['location']}{label_sep}\n{loc_plain_block}\n")

    if not is_free:
        lines.append(f"{labels['payment']}{label_sep}{payment_method_display}\n")
    total_plain = free_total_label if is_free else total_amount
    lines.append(f"{labels['total']}{label_sep}{total_plain}\n\n")
    if not is_free and is_pending_payment:
        lines.append(f"{PENDING_PAYMENT_NOTE[loc]}\n\n")
    if not is_free and include_fps_qr_image:
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
