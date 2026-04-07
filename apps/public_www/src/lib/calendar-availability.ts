export type CalendarUnavailablePeriod = 'am' | 'pm' | 'both';

export interface CalendarUnavailableSlot {
  date: string;
  period: CalendarUnavailablePeriod;
}

/** Shape of `src/content/calendar-availability.json` (and future API payloads). */
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
