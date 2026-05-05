import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS } from '@/lib/events-data';
import { PUBLIC_SITE_IANA_TIMEZONE } from '@/lib/site-datetime';

export const INTRO_CALL_SLOTS_API_PATH = '/v1/calendar/intro-call-slots';

export const INTRO_CALL_HORIZON_DAYS = 21;

export interface IntroCallSlot {
  startIso: string;
  endIso: string;
}

export interface IntroCallSlotsFetchResult {
  slots: IntroCallSlot[];
  fetchFailed: boolean;
}

const SITE_YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function ymdFromSiteTimeZoneForIntro(instant: Date): string {
  return SITE_YMD_FORMATTER.format(instant);
}

export function buildIntroCallSlotsApiPath(params: {
  fromYmd: string;
  toYmd: string;
}): string {
  const search = new URLSearchParams();
  search.set('from', params.fromYmd);
  search.set('to', params.toYmd);
  return `${INTRO_CALL_SLOTS_API_PATH}?${search.toString()}`;
}

function parseSlotsPayload(payload: unknown): IntroCallSlot[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const raw = (payload as { slots?: unknown }).slots;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: IntroCallSlot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const start = (row as { start_iso?: unknown }).start_iso;
    const end = (row as { end_iso?: unknown }).end_iso;
    if (typeof start === 'string' && typeof end === 'string' && start && end) {
      out.push({ startIso: start, endIso: end });
    }
  }
  return out;
}

export async function fetchIntroCallSlots(signal: AbortSignal): Promise<IntroCallSlotsFetchResult> {
  const client = createPublicCrmApiClient();
  if (!client) {
    return { slots: [], fetchFailed: true };
  }

  const now = new Date();
  const fromYmd = ymdFromSiteTimeZoneForIntro(now);
  const end = new Date(now.getTime() + INTRO_CALL_HORIZON_DAYS * 86400000);
  const toYmd = ymdFromSiteTimeZoneForIntro(end);

  try {
    const payload = await client.request({
      endpointPath: buildIntroCallSlotsApiPath({ fromYmd, toYmd }),
      method: 'GET',
      signal,
      bypassGetCache: true,
    });
    return { slots: parseSlotsPayload(payload), fetchFailed: false };
  } catch {
    return { slots: [], fetchFailed: true };
  }
}

export { CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS };
