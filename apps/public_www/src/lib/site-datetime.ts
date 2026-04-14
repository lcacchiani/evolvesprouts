import type { Locale } from '@/content';

/**
 * Canonical IANA timezone for public-facing schedule labels (events, bookings,
 * thank-you summaries). Keeps SSR and client output aligned.
 */
export const PUBLIC_SITE_IANA_TIMEZONE = 'Asia/Hong_Kong';

export function resolveDateTimeLocale(locale: Locale): string {
  if (locale === 'en') {
    return 'en-GB';
  }

  return locale;
}

const compactDateFormatterCache = new Map<Locale, Intl.DateTimeFormat>();
const timeOfDayFormatterCache = new Map<Locale, Intl.DateTimeFormat>();
const timeZoneShortFormatterCache = new Map<Locale, Intl.DateTimeFormat>();
const partDateFormatterCache = new Map<Locale, Intl.DateTimeFormat>();
const hktHour24Formatter = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  hour12: false,
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
});

function getCompactDateFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = compactDateFormatterCache.get(locale);
  if (cached) {
    return cached;
  }

  const next = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  });
  compactDateFormatterCache.set(locale, next);
  return next;
}

function getTimeOfDayFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = timeOfDayFormatterCache.get(locale);
  if (cached) {
    return cached;
  }

  const next =
    locale === 'en'
      ? new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: PUBLIC_SITE_IANA_TIMEZONE,
        })
      : new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: PUBLIC_SITE_IANA_TIMEZONE,
        });
  timeOfDayFormatterCache.set(locale, next);
  return next;
}

function getTimeZoneShortFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = timeZoneShortFormatterCache.get(locale);
  if (cached) {
    return cached;
  }

  const next = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
    timeZoneName: 'short',
  });
  timeZoneShortFormatterCache.set(locale, next);
  return next;
}

function getPartDateFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = partDateFormatterCache.get(locale);
  if (cached) {
    return cached;
  }

  const next = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    month: 'short',
    day: '2-digit',
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  });
  partDateFormatterCache.set(locale, next);
  return next;
}

/** Part date only (e.g. "16 May") in {@link PUBLIC_SITE_IANA_TIMEZONE}. */
export function formatSitePartDate(isoDateTime: string, locale: Locale): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return getPartDateFormatter(locale).format(date);
}

/**
 * "AM" or "PM" from the HKT wall-clock hour of the instant (12:00–12:59 → PM).
 */
export function formatSiteAmPmIndicator(isoDateTime: string): 'AM' | 'PM' | '' {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hour = Number(
    hktHour24Formatter.formatToParts(date).find((p) => p.type === 'hour')?.value,
  );
  if (!Number.isFinite(hour)) {
    return '';
  }

  return hour < 12 ? 'AM' : 'PM';
}

export function formatSiteCompactDate(isoDateTime: string, locale: Locale): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return getCompactDateFormatter(locale).format(date);
}

export function formatSiteTimeOfDay(isoDateTime: string, locale: Locale): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  let formatted = getTimeOfDayFormatter(locale).format(date);
  if (locale !== 'en') {
    formatted = formatted.replace(' AM', ' am').replace(' PM', ' pm');
  }

  return formatted;
}

export function formatSiteTimeZoneShortName(
  isoDateTime: string,
  locale: Locale,
): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timeZoneNamePart = getTimeZoneShortFormatter(locale)
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  return timeZoneNamePart?.trim() ?? '';
}

export function appendTimeZoneLabel(
  timeLabel: string | undefined,
  timeZoneLabel: string | undefined,
): string | undefined {
  const normalizedTimeLabel = timeLabel?.trim() ?? '';
  if (!normalizedTimeLabel) {
    return undefined;
  }

  const normalizedTimeZoneLabel = timeZoneLabel?.trim() ?? '';
  if (!normalizedTimeZoneLabel) {
    return normalizedTimeLabel;
  }

  if (
    normalizedTimeLabel.toLowerCase().includes(normalizedTimeZoneLabel.toLowerCase())
  ) {
    return normalizedTimeLabel;
  }

  return `${normalizedTimeLabel} ${normalizedTimeZoneLabel}`;
}

export function formatHeroFullDateLine(
  isoDateTime: string | undefined,
  locale: Locale,
): string | undefined {
  const normalizedIso = isoDateTime?.trim() ?? '';
  if (!normalizedIso) {
    return undefined;
  }

  const date = new Date(normalizedIso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const intlLocale = resolveDateTimeLocale(locale);
  const dateParts = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  }).formatToParts(date);
  const weekday = dateParts.find((part) => part.type === 'weekday')?.value;
  const day = dateParts.find((part) => part.type === 'day')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  const year = dateParts.find((part) => part.type === 'year')?.value;
  if (!weekday || !day || !month || !year) {
    return undefined;
  }

  return `${weekday} ${day} ${month} ${year}`;
}

export function formatSiteTimeRange(
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  locale: Locale,
): string | undefined {
  const normalizedStart = startDateTime?.trim() ?? '';
  if (!normalizedStart) {
    return undefined;
  }

  const startDate = new Date(normalizedStart);
  if (Number.isNaN(startDate.getTime())) {
    return undefined;
  }

  const startLabel = formatSiteTimeOfDay(normalizedStart, locale);
  const normalizedEnd = endDateTime?.trim() ?? '';
  if (!normalizedEnd) {
    return startLabel || undefined;
  }

  const endDate = new Date(normalizedEnd);
  if (Number.isNaN(endDate.getTime())) {
    return startLabel || undefined;
  }

  return `${startLabel} - ${formatSiteTimeOfDay(normalizedEnd, locale)}`;
}

export function formatPartDateTimeLabel(
  startDateTime: string,
  locale: Locale = 'en',
): string {
  const date = new Date(startDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const dateStr = getPartDateFormatter(locale).format(date);
  let timeStr = getTimeOfDayFormatter(locale).format(date);
  if (locale !== 'en') {
    timeStr = timeStr.replace(' AM', ' am').replace(' PM', ' pm');
  }

  return `${dateStr} @ ${timeStr}`;
}

/** Phase window length from each group session start (20 calendar days). */
const MY_BEST_AUNTIE_PHASE_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;

/**
 * Calendar start and end labels for a My Best Auntie phase row (month + day only, no year),
 * in {@link PUBLIC_SITE_IANA_TIMEZONE}. End is start + 20 days.
 */
export function formatMyBestAuntiePhaseWindowDateLabels(
  startDateTime: string,
  locale: Locale,
): { startLabel: string; endLabel: string } | null {
  const date = new Date(startDateTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const end = new Date(date.getTime() + MY_BEST_AUNTIE_PHASE_WINDOW_MS);
  if (Number.isNaN(end.getTime())) {
    return null;
  }

  const formatter = getPartDateFormatter(locale);
  return {
    startLabel: formatter.format(date),
    endLabel: formatter.format(end),
  };
}

export function formatTodayLongDate(locale: Locale): string {
  return new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  }).format(new Date());
}

export function formatCohortMonthYearLabel(
  year: number,
  monthIndex: number,
  locale: Locale,
): string {
  const monthLabel = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthIndex, 1)));

  return `${monthLabel}, ${year}`;
}
