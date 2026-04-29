export type CalendarUnavailablePeriod = 'am' | 'pm' | 'both';

export interface CalendarUnavailableSlot {
  date: string;
  period: CalendarUnavailablePeriod;
}

/** Public API `GET /v1/calendar/blockers` success body (and meta). */
export interface PublicCalendarBlockersApiPayload {
  blockers: CalendarUnavailableSlot[];
  meta?: {
    purpose?: string;
    from?: string;
    to?: string;
    wall_time_zone?: string;
  };
}

/** Shape of `src/content/calendar-availability.json` (legacy fallback / tests). */
export interface CalendarAvailabilityPayload {
  unavailable_slots: CalendarUnavailableSlot[];
}

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAvailabilityYmd(raw: string): string | null {
  const trimmed = raw.trim();
  if (!YMD_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Merges JSON/API slots into a per-date map. `both` blocks AM and PM for that calendar date.
 */
function isValidPeriod(value: unknown): value is CalendarUnavailablePeriod {
  return value === 'am' || value === 'pm' || value === 'both';
}

export function buildUnavailableSlotMap(
  slots: CalendarUnavailableSlot[],
): Map<string, { am: boolean; pm: boolean }> {
  const map = new Map<string, { am: boolean; pm: boolean }>();

  for (const slot of slots) {
    const ymd = normalizeAvailabilityYmd(slot.date);
    if (!ymd || !isValidPeriod(slot.period)) {
      continue;
    }

    if (slot.period === 'both') {
      map.set(ymd, { am: true, pm: true });
      continue;
    }

    const prev = map.get(ymd) ?? { am: false, pm: false };
    if (slot.period === 'am') {
      map.set(ymd, { am: true, pm: prev.pm });
    } else {
      map.set(ymd, { am: prev.am, pm: true });
    }
  }

  return map;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses public calendar blockers API JSON into slot rows for {@link buildUnavailableSlotMap}.
 */
export function parsePublicCalendarBlockersPayload(
  payload: unknown,
): CalendarUnavailableSlot[] {
  if (!isRecord(payload)) {
    return [];
  }
  const raw = payload.blockers ?? payload.unavailable_slots;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: CalendarUnavailableSlot[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const date = typeof item.date === 'string' ? item.date : '';
    const period = item.period;
    if (!date || !isValidPeriod(period)) {
      continue;
    }
    out.push({ date, period });
  }
  return out;
}

export function unavailableSlotMapToSlots(
  map: Map<string, { am: boolean; pm: boolean }>,
): CalendarUnavailableSlot[] {
  const out: CalendarUnavailableSlot[] = [];
  for (const ymd of [...map.keys()].sort()) {
    const row = map.get(ymd);
    if (!row) {
      continue;
    }
    if (row.am && row.pm) {
      out.push({ date: ymd, period: 'both' });
    } else if (row.am) {
      out.push({ date: ymd, period: 'am' });
    } else if (row.pm) {
      out.push({ date: ymd, period: 'pm' });
    }
  }
  return out;
}
