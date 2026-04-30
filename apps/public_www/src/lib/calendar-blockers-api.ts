import {
  type CalendarUnavailableSlot,
  parsePublicCalendarBlockersPayload,
} from '@/lib/calendar-availability';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS } from '@/lib/events-data';
import { PUBLIC_SITE_IANA_TIMEZONE } from '@/lib/site-datetime';

export const CALENDAR_BLOCKERS_API_PATH = '/v1/calendar/blockers';

/** Must match `app.services.calendar_blockers.consultation_booking_purpose()`. */
export const CONSULTATION_BOOKING_BLOCKERS_PURPOSE = 'consultation_booking';

export interface ConsultationCalendarBlockersFetchResult {
  slots: CalendarUnavailableSlot[];
  /** True when the CRM client is missing or the HTTP request failed. */
  fetchFailed: boolean;
}

const SITE_YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const SITE_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  weekday: 'short',
});

/** YYYY-MM-DD for the calendar date of `instant` in {@link PUBLIC_SITE_IANA_TIMEZONE}. */
export function ymdFromSiteTimeZone(instant: Date): string {
  return SITE_YMD_FORMATTER.format(instant);
}

const _WEEKDAY_TO_OFFSET: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Noon on `ymd` in the site zone (HKT has no DST; fixed +08:00). */
function noonSiteOnYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+08:00`);
}

/**
 * Monday of the ISO week containing `instant`, in the site IANA zone (same “today” as the
 * consultation picker). Returned as noon that Monday in +08:00 for stable day arithmetic.
 */
function startOfWeekMondaySiteTz(instant: Date): Date {
  const ymd = ymdFromSiteTimeZone(instant);
  const noon = noonSiteOnYmd(ymd);
  const wdLabel = SITE_WEEKDAY_FORMATTER.format(noon);
  const dow = _WEEKDAY_TO_OFFSET[wdLabel] ?? 0;
  const offsetFromMonday = (dow + 6) % 7;
  return new Date(noon.getTime() - offsetFromMonday * 86400000);
}

/** Inclusive end date: start Monday + 119 days (17 weeks − 1 day), still ≤120-day API span. */
export function buildConsultationBlockersQueryRange(now: Date): {
  fromYmd: string;
  toYmd: string;
} {
  const start = startOfWeekMondaySiteTz(now);
  const end = new Date(start.getTime() + 119 * 86400000);
  return { fromYmd: ymdFromSiteTimeZone(start), toYmd: ymdFromSiteTimeZone(end) };
}

export function buildCalendarBlockersApiPath(params: {
  purpose: string;
  fromYmd: string;
  toYmd: string;
}): string {
  const search = new URLSearchParams();
  search.set('purpose', params.purpose);
  search.set('from', params.fromYmd);
  search.set('to', params.toYmd);
  return `${CALENDAR_BLOCKERS_API_PATH}?${search.toString()}`;
}

/**
 * Fetches merged manual + session calendar blockers for the public website.
 * Returns empty slots with `fetchFailed` when the CRM client is missing or the request fails.
 */
export async function fetchConsultationCalendarBlockersSlots(
  signal: AbortSignal,
): Promise<ConsultationCalendarBlockersFetchResult> {
  const client = createPublicCrmApiClient();
  if (!client) {
    return { slots: [], fetchFailed: true };
  }

  const { fromYmd, toYmd } = buildConsultationBlockersQueryRange(new Date());

  try {
    const payload = await client.request({
      endpointPath: buildCalendarBlockersApiPath({
        purpose: CONSULTATION_BOOKING_BLOCKERS_PURPOSE,
        fromYmd,
        toYmd,
      }),
      method: 'GET',
      signal,
      bypassGetCache: true,
    });
    return { slots: parsePublicCalendarBlockersPayload(payload), fetchFailed: false };
  } catch {
    return { slots: [], fetchFailed: true };
  }
}

export { CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS };
