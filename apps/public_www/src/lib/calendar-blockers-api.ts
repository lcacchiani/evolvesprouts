import calendarAvailabilityFallback from '@/content/calendar-availability.json';
import {
  CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS,
  createPublicCrmApiClient,
  CrmApiRequestError,
} from '@/lib/crm-api-client';
import {
  type CalendarUnavailableSlot,
  buildUnavailableSlotMap,
  parsePublicCalendarBlockersPayload,
  unavailableSlotMapToSlots,
} from '@/lib/calendar-availability';

export const CALENDAR_BLOCKERS_API_PATH = '/v1/calendar/blockers';

/** Must match `app.services.calendar_blockers.consultation_booking_purpose()`. */
export const CONSULTATION_BOOKING_BLOCKERS_PURPOSE = 'consultation_booking';

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
 * Returns empty slots when the CRM client is missing or the request fails.
 */
export async function fetchConsultationCalendarBlockersSlots(
  signal: AbortSignal,
): Promise<CalendarUnavailableSlot[]> {
  const client = createPublicCrmApiClient();
  if (!client) {
    return [];
  }

  const today = new Date();
  const fromYmd = ymdFromLocalDate(today);
  const end = new Date(today.getTime() + 120 * 86400000);
  const toYmd = ymdFromLocalDate(end);

  try {
    const payload = await client.request({
      endpointPath: buildCalendarBlockersApiPath({
        purpose: CONSULTATION_BOOKING_BLOCKERS_PURPOSE,
        fromYmd,
        toYmd,
      }),
      method: 'GET',
      signal,
    });
    const remote = parsePublicCalendarBlockersPayload(payload);
    const merged = buildUnavailableSlotMap([
      ...calendarAvailabilityFallback.unavailable_slots,
      ...remote,
    ]);
    return unavailableSlotMapToSlots(merged);
  } catch (error) {
    if (error instanceof CrmApiRequestError && error.statusCode === 404) {
      return unavailableSlotMapToSlots(
        buildUnavailableSlotMap(calendarAvailabilityFallback.unavailable_slots),
      );
    }
    return unavailableSlotMapToSlots(
      buildUnavailableSlotMap(calendarAvailabilityFallback.unavailable_slots),
    );
  }
}

export { CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS };
