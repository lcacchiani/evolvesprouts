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

export interface BuildBookingIcsContentInput {
  title: string;
  dateStartTime: string;
  dateEndTime?: string;
  location: string;
}

export function buildBookingIcsContent(input: BuildBookingIcsContentInput): string | null {
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

  const uidSource =
    typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `booking-${Date.now()}`;
  const uid = escapeIcalText(uidSource);
  const now = new Date();
  const dtStamp = formatIcsUtcFromIso(now.toISOString()) ?? dtStart;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Evolve Sprouts//Booking//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
  ];
  pushFoldedProperty(lines, 'SUMMARY', input.title);
  pushFoldedProperty(lines, 'LOCATION', input.location);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return `${lines.join('\r\n')}\r\n`;
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
