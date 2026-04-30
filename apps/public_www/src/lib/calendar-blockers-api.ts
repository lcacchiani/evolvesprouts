import {
  type CalendarUnavailableSlot,
  parsePublicCalendarBlockersPayload,
} from '@/lib/calendar-availability';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS } from '@/lib/events-data';

export const CALENDAR_BLOCKERS_API_PATH = '/v1/calendar/blockers';

/** Must match `app.services.calendar_blockers.consultation_booking_purpose()`. */
export const CONSULTATION_BOOKING_BLOCKERS_PURPOSE = 'consultation_booking';

export interface ConsultationCalendarBlockersFetchResult {
  slots: CalendarUnavailableSlot[];
  /** True when the CRM client is missing or the HTTP request failed. */
  fetchFailed: boolean;
}

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday 00:00 local of the week containing `d` (local calendar). */
function startOfWeekMondayLocal(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = copy.getDay(); // 0 Sun .. 6 Sat
  const offsetFromMonday = (dow + 6) % 7;
  copy.setDate(copy.getDate() - offsetFromMonday);
  return copy;
}

/** Inclusive end date: start Monday + 119 days (17 weeks − 1 day), still ≤120-day API span. */
export function buildConsultationBlockersQueryRange(now: Date): {
  fromYmd: string;
  toYmd: string;
} {
  const start = startOfWeekMondayLocal(now);
  const end = new Date(start.getTime() + 119 * 86400000);
  return { fromYmd: ymdFromLocalDate(start), toYmd: ymdFromLocalDate(end) };
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
