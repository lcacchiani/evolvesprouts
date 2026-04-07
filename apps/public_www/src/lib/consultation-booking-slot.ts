import { resolveDateTimeLocale } from '@/lib/site-datetime';

import type { Locale } from '@/content';

export type ConsultationDayPeriod = 'am' | 'pm';

/** First home-visit slot in the user's local (browser) calendar day. */
export const CONSULTATION_SLOT_AM_HOUR_LOCAL = 9;
export const CONSULTATION_SLOT_PM_HOUR_LOCAL = 14;

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
  /** ISO-like calendar key `YYYY-MM-DD` in the given IANA timezone. */
  ymd: string;
  /** Day of month 1–31 for display. */
  dayOfMonth: number;
  /** Disabled (before today in that timezone). */
  isDisabled: boolean;
}

export interface ConsultationPickerWeekRow {
  /** Monday–Friday cells; Saturday/Sunday omitted. */
  days: ConsultationPickerDayCell[];
}

function ymdFromInstantInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function weekdayMondayFirstIndexInZone(instant: Date, timeZone: string): number {
  const long = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  }).format(instant);
  const idx = WEEKDAY_LONG_MONDAY_FIRST.indexOf(
    long as (typeof WEEKDAY_LONG_MONDAY_FIRST)[number],
  );
  return idx >= 0 ? idx : 0;
}

function addCalendarDaysInZone(ymd: string, deltaDays: number, timeZone: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const baseUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  return ymdFromInstantInZone(new Date(baseUtcMs + deltaDays * 86400000), timeZone);
}

function ymdToDayOfMonth(ymd: string): number {
  const day = Number(ymd.slice(8, 10));
  return Number.isFinite(day) ? day : 1;
}

/**
 * Monday of the week containing `instant`, in the given IANA timezone calendar.
 */
export function getMondayOfWeekContainingInZone(instant: Date, timeZone: string): string {
  const todayYmd = ymdFromInstantInZone(instant, timeZone);
  const mondayIndex = weekdayMondayFirstIndexInZone(instant, timeZone);
  return addCalendarDaysInZone(todayYmd, -mondayIndex, timeZone);
}

/**
 * Four consecutive weeks (Mon–Fri only each week), starting at the Monday of the current week in `timeZone`.
 */
export function buildConsultationPickerWeeks(
  timeZone: string,
  now: Date = new Date(),
): ConsultationPickerWeekRow[] {
  const startMondayYmd = getMondayOfWeekContainingInZone(now, timeZone);
  const todayYmd = ymdFromInstantInZone(now, timeZone);
  const weeks: ConsultationPickerWeekRow[] = [];

  for (let w = 0; w < 4; w += 1) {
    const weekStart = addCalendarDaysInZone(startMondayYmd, w * 7, timeZone);
    const days: ConsultationPickerDayCell[] = [];
    for (let d = 0; d < 5; d += 1) {
      const ymd = addCalendarDaysInZone(weekStart, d, timeZone);
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

const zoneWallClockPartsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const zoneYmdFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getZoneWallClockPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneWallClockPartsFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }
  const next = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
    minute: 'numeric',
    second: 'numeric',
  });
  zoneWallClockPartsFormatterCache.set(timeZone, next);
  return next;
}

function getZoneYmdFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneYmdFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }
  const next = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  zoneYmdFormatterCache.set(timeZone, next);
  return next;
}

/**
 * UTC instant for `ymd` at `hour`:`minute`:00 local wall time in `timeZone`.
 */
export function zoneWallClockYmdToUtcIso(
  ymd: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const [y, m, d] = ymd.split('-').map(Number);
  let guessUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const ymdFormatter = getZoneYmdFormatter(timeZone);
  const clockFormatter = getZoneWallClockPartsFormatter(timeZone);

  for (let i = 0; i < 48; i += 1) {
    const date = new Date(guessUtcMs);
    const shownYmd = ymdFormatter.format(date);
    if (shownYmd !== ymd) {
      guessUtcMs += shownYmd < ymd ? 12 * 3600000 : -12 * 3600000;
      continue;
    }

    const parts = clockFormatter.formatToParts(date);
    const partHour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
    const partMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN);
    const partSecond = Number(parts.find((p) => p.type === 'second')?.value ?? NaN);
    if (
      !Number.isFinite(partHour) ||
      !Number.isFinite(partMinute) ||
      !Number.isFinite(partSecond)
    ) {
      break;
    }

    if (partHour === hour && partMinute === minute && partSecond === 0) {
      return date.toISOString();
    }

    const wantMs = (hour * 60 + minute) * 60000;
    const haveMs = (partHour * 60 + partMinute) * 60000 + partSecond * 1000;
    guessUtcMs += wantMs - haveMs;
  }

  return new Date(guessUtcMs).toISOString();
}

export function resolveConsultationSlotStartIso(
  ymd: string,
  period: ConsultationDayPeriod,
  timeZone: string,
): string {
  const hour =
    period === 'am' ? CONSULTATION_SLOT_AM_HOUR_LOCAL : CONSULTATION_SLOT_PM_HOUR_LOCAL;
  return zoneWallClockYmdToUtcIso(ymd, hour, 0, timeZone);
}

export function rebaseConsultationDateParts(
  parts: ConsultationBookingDatePart[],
  selectedYmd: string,
  period: ConsultationDayPeriod,
  timeZone: string,
): ConsultationBookingDatePart[] {
  if (parts.length === 0) {
    return parts;
  }

  const first = parts[0];
  const originalFirstStart = new Date(first.startDateTime).getTime();
  if (Number.isNaN(originalFirstStart)) {
    return parts;
  }

  const newFirstStart = new Date(
    resolveConsultationSlotStartIso(selectedYmd, period, timeZone),
  ).getTime();
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

export function collectDistinctYearMonthsFromYmds(ymds: string[]): { year: number; month: number }[] {
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
  timeZone: string,
): string {
  if (yearMonthPairs.length === 0) {
    return '';
  }

  const intlLocale = resolveDateTimeLocale(locale);
  const fmt = new Intl.DateTimeFormat(intlLocale, {
    month: 'long',
    year: 'numeric',
    timeZone,
  });

  const labels = yearMonthPairs.map(({ year, month }) => {
    return fmt.format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0)));
  });

  return labels.join(joiner);
}

/**
 * Resolves the environment's default IANA timezone (browser: user's zone; Node: typically UTC).
 */
export function resolveDefaultDateTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (tz) {
      return tz;
    }
  } catch {
    /* fall through */
  }
  return 'UTC';
}
