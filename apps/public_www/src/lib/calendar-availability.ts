export type CalendarUnavailablePeriod = 'am' | 'pm' | 'both';

export interface CalendarUnavailableSlot {
  date: string;
  period: CalendarUnavailablePeriod;
}

function enumerateInclusiveYmd(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  if (fromYmd > toYmd) {
    return out;
  }
  let cur = fromYmd;
  // Lexicographic compare works for ISO dates when same calendar system as inputs.
  while (true) {
    out.push(cur);
    if (cur >= toYmd) {
      break;
    }
    cur = addOneCalendarDayYmd(cur);
  }
  return out;
}

function addOneCalendarDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((p) => Number(p));
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function utcMillisForWallMidnightWithFormatter(
  ymd: string,
  ymdFormatter: Intl.DateTimeFormat,
): number {
  const [y, mo, d] = ymd.split('-').map((part) => Number(part));
  let utc = Date.UTC(y, mo - 1, d, 0, 0, 0);
  for (let i = 0; i < 48; i += 1) {
    if (ymdFormatter.format(new Date(utc)) === ymd) {
      return utc;
    }
    utc += 3600000;
  }
  return Date.UTC(y, mo - 1, d, 0, 0, 0);
}

/**
 * Derives consultation picker half-day blockers from discrete slot intervals.
 * A half-day is treated as available iff a slot exists whose start matches 09:00 or 14:00 local
 * on that calendar date in ``wallTimeZone``.
 */
export function deriveHalfDayBlockersFromSlots(
  slots: Array<{ startIso: string }>,
  wallTimeZone: string,
  ymdRange: { fromYmd: string; toYmd: string },
): CalendarUnavailableSlot[] {
  const ymdFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: wallTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const hourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: wallTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const wdFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: wallTimeZone,
    weekday: 'short',
  });

  const amOk = new Set<string>();
  const pmOk = new Set<string>();

  for (const slot of slots) {
    let instant: Date;
    try {
      instant = new Date(slot.startIso);
    } catch {
      continue;
    }
    if (Number.isNaN(instant.getTime())) {
      continue;
    }
    const ymd = ymdFmt.format(instant);
    const hmRaw = hourFmt.format(instant);
    const [hh, mm] = hmRaw.split(':').map((x) => Number(x));
    const weekdayShort = wdFmt.format(instant);
    if (weekdayShort === 'Sat' || weekdayShort === 'Sun') {
      continue;
    }
    if (hh === 9 && mm === 0) {
      amOk.add(ymd);
    }
    if (hh === 14 && mm === 0) {
      pmOk.add(ymd);
    }
  }

  const out: CalendarUnavailableSlot[] = [];
  for (const ymd of enumerateInclusiveYmd(ymdRange.fromYmd, ymdRange.toYmd)) {
    const noonProbe = new Date(utcMillisForWallMidnightWithFormatter(ymd, ymdFmt) + 12 * 3600000);
    const wd = wdFmt.format(noonProbe);
    if (wd === 'Sat' || wd === 'Sun') {
      out.push({ date: ymd, period: 'am' }, { date: ymd, period: 'pm' });
      continue;
    }
    if (!amOk.has(ymd)) {
      out.push({ date: ymd, period: 'am' });
    }
    if (!pmOk.has(ymd)) {
      out.push({ date: ymd, period: 'pm' });
    }
  }
  return out;
}

/** Props shape for the consultation booking modal (picker unavailable half-days). */
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
