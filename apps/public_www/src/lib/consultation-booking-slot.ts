import {
  PUBLIC_SITE_IANA_TIMEZONE,
  resolveDateTimeLocale,
} from '@/lib/site-datetime';

import type { Locale } from '@/content';

export type ConsultationDayPeriod = 'am' | 'pm';

/** First home-visit slot in HKT (consultation booking picker). */
export const CONSULTATION_SLOT_AM_HOUR_HKT = 9;
export const CONSULTATION_SLOT_PM_HOUR_HKT = 14;

const WEEKDAY_LONG_MONDAY_FIRST = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface ConsultationBookingDatePart {
  id: string;
  startDateTime: string;
  endDateTime: string;
  description: string;
}

export interface ConsultationPickerDayCell {
  /** ISO-like calendar key `YYYY-MM-DD` in Asia/Hong_Kong. */
  ymd: string;
  /** Day of month 1–31 for display. */
  dayOfMonth: number;
  /** Disabled (before today in HKT). */
  isDisabled: boolean;
}

export interface ConsultationPickerWeekRow {
  /** Monday–Friday cells; Saturday/Sunday omitted. */
  days: ConsultationPickerDayCell[];
}

function hkYmdFromInstant(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function hkWeekdayMondayFirstIndex(instant: Date): number {
  const long = new Intl.DateTimeFormat('en-US', {
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
    weekday: 'long',
  }).format(instant);
  const idx = WEEKDAY_LONG_MONDAY_FIRST.indexOf(
    long as (typeof WEEKDAY_LONG_MONDAY_FIRST)[number],
  );
  return idx >= 0 ? idx : 0;
}

function addCalendarDaysHk(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const baseUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  return hkYmdFromInstant(new Date(baseUtcMs + deltaDays * 86400000));
}

function ymdToDayOfMonth(ymd: string): number {
  const day = Number(ymd.slice(8, 10));
  return Number.isFinite(day) ? day : 1;
}

/**
 * Monday of the week containing `instant`, measured in Hong Kong calendar dates.
 */
export function getHkMondayOfWeekContaining(instant: Date): string {
  const todayYmd = hkYmdFromInstant(instant);
  const mondayIndex = hkWeekdayMondayFirstIndex(instant);
  return addCalendarDaysHk(todayYmd, -mondayIndex);
}

/**
 * Four consecutive weeks (Mon–Fri only each week), starting at the Monday of the current HK week.
 */
export function buildConsultationPickerWeeks(now: Date = new Date()): ConsultationPickerWeekRow[] {
  const startMondayYmd = getHkMondayOfWeekContaining(now);
  const todayYmd = hkYmdFromInstant(now);
  const weeks: ConsultationPickerWeekRow[] = [];

  for (let w = 0; w < 4; w += 1) {
    const weekStart = addCalendarDaysHk(startMondayYmd, w * 7);
    const days: ConsultationPickerDayCell[] = [];
    for (let d = 0; d < 5; d += 1) {
      const ymd = addCalendarDaysHk(weekStart, d);
      days.push({
        ymd,
        dayOfMonth: ymdToDayOfMonth(ymd),
        isDisabled: ymd < todayYmd,
      });
    }
    weeks.push({ days });
  }

  return weeks;
}

export function pickDefaultConsultationYmd(weeks: ConsultationPickerWeekRow[]): string | null {
  for (const row of weeks) {
    for (const cell of row.days) {
      if (!cell.isDisabled) {
        return cell.ymd;
      }
    }
  }
  return null;
}

export function hktWallClockToUtcIso(
  ymd: string,
  hourHkt: number,
  minuteHkt: number,
): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hourHkt - 8, minuteHkt, 0, 0);
  return new Date(utcMs).toISOString();
}

export function resolveConsultationSlotStartIso(
  ymd: string,
  period: ConsultationDayPeriod,
): string {
  const hour = period === 'am' ? CONSULTATION_SLOT_AM_HOUR_HKT : CONSULTATION_SLOT_PM_HOUR_HKT;
  return hktWallClockToUtcIso(ymd, hour, 0);
}

export function rebaseConsultationDateParts(
  parts: ConsultationBookingDatePart[],
  selectedYmd: string,
  period: ConsultationDayPeriod,
): ConsultationBookingDatePart[] {
  if (parts.length === 0) {
    return parts;
  }

  const first = parts[0];
  const originalFirstStart = new Date(first.startDateTime).getTime();
  if (Number.isNaN(originalFirstStart)) {
    return parts;
  }

  const newFirstStart = new Date(resolveConsultationSlotStartIso(selectedYmd, period)).getTime();
  const deltaMs = newFirstStart - originalFirstStart;

  return parts.map((part) => {
    const startMs = new Date(part.startDateTime).getTime();
    const endMs = new Date(part.endDateTime).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return part;
    }
    return {
      ...part,
      startDateTime: new Date(startMs + deltaMs).toISOString(),
      endDateTime: new Date(endMs + deltaMs).toISOString(),
    };
  });
}

export function collectDistinctHkYearMonthsFromYmds(ymds: string[]): { year: number; month: number }[] {
  const keys = new Set<string>();
  const out: { year: number; month: number }[] = [];
  for (const ymd of ymds) {
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(5, 7));
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
      continue;
    }
    const key = `${y}-${m}`;
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    out.push({ year: y, month: m });
  }
  out.sort((a, b) => {
    if (a.year !== b.year) {
      return a.year - b.year;
    }
    return a.month - b.month;
  });
  return out;
}

export function formatConsultationPickerMonthHeading(
  yearMonthPairs: { year: number; month: number }[],
  locale: Locale,
  joiner: string,
): string {
  if (yearMonthPairs.length === 0) {
    return '';
  }

  const intlLocale = resolveDateTimeLocale(locale);
  const fmt = new Intl.DateTimeFormat(intlLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  });

  const labels = yearMonthPairs.map(({ year, month }) => {
    return fmt.format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0)));
  });

  return labels.join(joiner);
}
