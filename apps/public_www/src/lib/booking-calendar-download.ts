function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function formatIcsUtcFromIso(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${parsed.getUTCFullYear()}`
    + `${pad(parsed.getUTCMonth() + 1)}`
    + `${pad(parsed.getUTCDate())}T`
    + `${pad(parsed.getUTCHours())}`
    + `${pad(parsed.getUTCMinutes())}`
    + `${pad(parsed.getUTCSeconds())}Z`
  );
}

function addOneHourUtcIso(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setTime(parsed.getTime() + 60 * 60 * 1000);
  return parsed.toISOString();
}

function foldIcsLine(line: string): string {
  const max = 75;
  if (line.length <= max) {
    return line;
  }

  const parts: string[] = [];
  let rest = line;
  while (rest.length > max) {
    parts.push(rest.slice(0, max));
    rest = ` ${rest.slice(max)}`;
  }
  if (rest) {
    parts.push(rest);
  }

  return parts.join('\r\n');
}

function pushFoldedProperty(lines: string[], name: string, value: string): void {
  const escaped = escapeIcalText(value);
  const folded = foldIcsLine(`${name}:${escaped}`);
  lines.push(...folded.split('\r\n'));
}

export function sanitizeBookingIcsFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]+/gu, '')
    .replace(/\s+/gu, '-')
    .slice(0, 80);
  return base || 'booking';
}

export interface BuildBookingIcsSessionSlice {
  dateStartTime: string;
  dateEndTime?: string;
}

export interface BuildBookingIcsCalendarInput {
  title: string;
  location: string;
  sessions: BuildBookingIcsSessionSlice[];
}

function buildSingleVeventLines(input: {
  title: string;
  location: string;
  dateStartTime: string;
  dateEndTime?: string;
  uidSuffix: string;
  dtStamp: string;
}): string[] | null {
  const dtStart = formatIcsUtcFromIso(input.dateStartTime);
  if (!dtStart) {
    return null;
  }

  let dtEnd = input.dateEndTime ? formatIcsUtcFromIso(input.dateEndTime) : null;
  if (!dtEnd) {
    const plusOne = addOneHourUtcIso(input.dateStartTime);
    dtEnd = plusOne ? formatIcsUtcFromIso(plusOne) : null;
  }
  if (!dtEnd) {
    return null;
  }

  const uid = escapeIcalText(input.uidSuffix);
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${input.dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
  ];
  pushFoldedProperty(lines, 'SUMMARY', input.title);
  pushFoldedProperty(lines, 'LOCATION', input.location);
  lines.push('END:VEVENT');

  return lines;
}

export function buildBookingIcsCalendarContent(
  input: BuildBookingIcsCalendarInput,
): string | null {
  if (input.sessions.length === 0) {
    return null;
  }

  const rootUid =
    typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `booking-${Date.now()}`;
  const now = new Date();
  const dtStamp =
    formatIcsUtcFromIso(now.toISOString())
    ?? formatIcsUtcFromIso(input.sessions[0]?.dateStartTime ?? '')
    ?? '19700101T000000Z';

  const eventBlocks: string[][] = [];
  for (let index = 0; index < input.sessions.length; index += 1) {
    const session = input.sessions[index];
    const block = buildSingleVeventLines({
      title: input.title,
      location: input.location,
      dateStartTime: session.dateStartTime,
      dateEndTime: session.dateEndTime,
      uidSuffix: `${rootUid}-${index}`,
      dtStamp,
    });
    if (!block) {
      return null;
    }

    eventBlocks.push(block);
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Evolve Sprouts//Booking//EN',
    'CALSCALE:GREGORIAN',
    ...eventBlocks.flat(),
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

export interface BuildBookingIcsContentInput {
  title: string;
  dateStartTime: string;
  dateEndTime?: string;
  location: string;
}

export function buildBookingIcsContent(input: BuildBookingIcsContentInput): string | null {
  return buildBookingIcsCalendarContent({
    title: input.title,
    location: input.location,
    sessions: [{ dateStartTime: input.dateStartTime, dateEndTime: input.dateEndTime }],
  });
}

export function triggerBookingIcsDownload(icsBody: string, filenameBase: string): void {
  const blob = new Blob([icsBody], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeBookingIcsFilename(filenameBase)}.ics`;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
