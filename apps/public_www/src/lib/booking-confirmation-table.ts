/**
 * Mirrors booking confirmation email row logic in
 * `backend/src/app/templates/booking_confirmation_render.py`
 * so the thank-you modal matches the SES email table.
 */

import type { ReservationPaymentMethodCode } from '@/lib/reservations-data';

const HK_LOCATION_MARKERS = [
  'hong kong',
  'hk',
  'h.k.',
  '香港',
  'kowloon',
  '九龍',
  '九龙',
  'new territories',
  '新界',
  'sheung wan',
  '上環',
  '上环',
  'wan chai',
  '灣仔',
  '湾仔',
  'central',
  '中環',
  '中环',
  'admiralty',
  '金鐘',
  '金钟',
  'causeway bay',
  '銅鑼灣',
  '铜锣湾',
  'mid-levels',
  '半山',
  'shek tong tsui',
  '石塘咀',
  'pacific place',
  '太古廣場',
  '太古广场',
] as const;

const MONTH_NAMES_EN = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Same values as `PAYMENT_METHOD_LABELS` in booking_confirmation_content.py */
export const BOOKING_CONFIRMATION_PAYMENT_LABELS: Record<
  ReservationPaymentMethodCode,
  string
> = {
  fps_qr: 'FPS',
  bank_transfer: 'Bank Transfer',
  stripe: 'Credit Card',
};

export interface BookingConfirmationTableLabels {
  service: string;
  datetime: string;
  location: string;
  details: string;
  payment: string;
  total: string;
}

export interface BookingConfirmationDetailsPrefixes {
  cohort: string;
  ageGroup: string;
  writingFocus: string;
  level: string;
}

function normalizeCourseSlug(courseSlug: string | undefined): string {
  return (courseSlug ?? '').trim().toLowerCase();
}

function normalizeLocationMatchText(
  locationName: string | undefined,
  locationAddress: string | undefined,
): string {
  const parts = [locationName, locationAddress]
    .map((p) => (p ?? '').trim().toLowerCase())
    .filter(Boolean);
  return parts.join(' ');
}

export function locationSuggestsHongKong(
  locationName: string | undefined,
  locationAddress: string | undefined,
): boolean {
  const blob = normalizeLocationMatchText(locationName, locationAddress);
  if (!blob) {
    return false;
  }
  return HK_LOCATION_MARKERS.some((marker) => blob.includes(marker));
}

export function formatBookingLocationDisplayLine(
  locationName: string | undefined,
  locationAddress: string | undefined,
): string | null {
  const name = (locationName ?? '').trim();
  const addr = (locationAddress ?? '').trim();
  if (name && addr) {
    if (name.toLowerCase() === addr.toLowerCase()) {
      return name;
    }
    return `${name}, ${addr}`;
  }
  if (name) {
    return name;
  }
  if (addr) {
    return addr;
  }
  return null;
}

function hasExplicitTimezoneOffset(iso: string): boolean {
  return /Z$/i.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso) || /[+-]\d{4}$/.test(iso);
}

function parseIsoDatetime(value: string | undefined | null): Date | null {
  const raw = (value ?? '').trim();
  if (!raw) {
    return null;
  }
  let normalized = raw.endsWith('Z') ? `${raw.slice(0, -1)}+00:00` : raw;
  if (!hasExplicitTimezoneOffset(normalized)) {
    normalized = `${normalized}+08:00`;
  }
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function formatHktEmailLine(iso: string): string | null {
  const dt = parseIsoDatetime(iso);
  if (!dt) {
    return null;
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dt);
  const dayPart = parts.find((p) => p.type === 'day')?.value;
  const monthPart = parts.find((p) => p.type === 'month')?.value;
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minutePart = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const day = Number(dayPart);
  const month = Number(monthPart);
  if (!day || !month || month < 1 || month > 12) {
    return null;
  }
  const monthName = MONTH_NAMES_EN[month];
  const hm = `${hourPart.padStart(2, '0')}:${minutePart.padStart(2, '0')}`;
  return `${day} ${monthName} @ ${hm} HKT`;
}

export function formatScheduleDatetimeLine(
  scheduleDateLabel: string | undefined | null,
  scheduleTimeLabel: string | undefined | null,
): string | null {
  const dateS = (scheduleDateLabel ?? '').trim();
  const timeS = (scheduleTimeLabel ?? '').trim();
  if (dateS && timeS) {
    return `${dateS} ${timeS}`;
  }
  if (timeS) {
    return timeS;
  }
  if (dateS) {
    return dateS;
  }
  return null;
}

export function formatBookingDatetimeDisplay(input: {
  primarySessionIso: string | undefined | null;
  scheduleDateLabel: string | undefined | null;
  scheduleTimeLabel: string | undefined | null;
  locationUseHkt: boolean;
}): string | null {
  const { primarySessionIso, scheduleDateLabel, scheduleTimeLabel, locationUseHkt } =
    input;
  if (locationUseHkt) {
    const primary = (primarySessionIso ?? '').trim();
    if (primary) {
      const hktLine = formatHktEmailLine(primary);
      if (hktLine) {
        return hktLine;
      }
    }
    const line = formatScheduleDatetimeLine(scheduleDateLabel, scheduleTimeLabel);
    if (!line) {
      return null;
    }
    if (!line.toLowerCase().includes('hkt')) {
      return `${line} HKT`;
    }
    return line;
  }
  return formatScheduleDatetimeLine(scheduleDateLabel, scheduleTimeLabel);
}

function cohortLabelForMbaDetails(
  courseSlug: string | undefined,
  scheduleDateLabel: string | undefined,
): string | null {
  if (normalizeCourseSlug(courseSlug) !== 'my-best-auntie') {
    return null;
  }
  const s = (scheduleDateLabel ?? '').trim();
  return s || null;
}

export function formatBookingDetailsLines(input: {
  courseSlug: string | undefined;
  scheduleDateLabel: string | undefined;
  ageGroupLabel: string | undefined;
  consultationWritingFocusLabel: string | undefined;
  consultationLevelLabel: string | undefined;
  prefixes: BookingConfirmationDetailsPrefixes;
}): string[] {
  const slug = normalizeCourseSlug(input.courseSlug);
  const cohortForMba = cohortLabelForMbaDetails(
    input.courseSlug,
    input.scheduleDateLabel,
  );

  if (slug === 'my-best-auntie') {
    const cohort = (cohortForMba ?? '').trim();
    const age = (input.ageGroupLabel ?? '').trim();
    const lines: string[] = [];
    if (cohort) {
      lines.push(`${input.prefixes.cohort}: ${cohort}`);
    }
    if (age) {
      lines.push(`${input.prefixes.ageGroup}: ${age}`);
    }
    return lines;
  }

  if (slug === 'consultation-booking') {
    const focus = (input.consultationWritingFocusLabel ?? '').trim();
    const level = (input.consultationLevelLabel ?? '').trim();
    const lines: string[] = [];
    if (focus) {
      lines.push(`${input.prefixes.writingFocus}: ${focus}`);
    }
    if (level) {
      lines.push(`${input.prefixes.level}: ${level}`);
    }
    return lines;
  }

  return [];
}

export function resolvePaymentMethodDisplayForConfirmation(
  code: string | undefined | null,
): string {
  const key = (code ?? '').trim().toLowerCase() as ReservationPaymentMethodCode;
  if (key in BOOKING_CONFIRMATION_PAYMENT_LABELS) {
    return BOOKING_CONFIRMATION_PAYMENT_LABELS[key];
  }
  const raw = (code ?? '').trim();
  return raw || 'unknown';
}

export interface BookingConfirmationTableRow {
  label: string;
  value: string;
  multiline?: boolean;
}

export function buildBookingConfirmationTableRows(input: {
  courseLabel: string;
  labels: BookingConfirmationTableLabels;
  detailsPrefixes: BookingConfirmationDetailsPrefixes;
  courseSlug: string | undefined;
  scheduleDateLabel: string | undefined;
  scheduleTimeLabel: string | undefined;
  primarySessionIso: string | undefined;
  ageGroupLabel: string | undefined;
  consultationWritingFocusLabel: string | undefined;
  consultationLevelLabel: string | undefined;
  locationName: string | undefined;
  locationAddress: string | undefined;
  paymentMethodCode: string | undefined;
  totalAmountFormatted: string;
}): BookingConfirmationTableRow[] {
  const useHkt = locationSuggestsHongKong(
    input.locationName,
    input.locationAddress,
  );
  const scheduleLine = formatBookingDatetimeDisplay({
    primarySessionIso: input.primarySessionIso,
    scheduleDateLabel: input.scheduleDateLabel,
    scheduleTimeLabel: input.scheduleTimeLabel,
    locationUseHkt: useHkt,
  });
  const locLine = formatBookingLocationDisplayLine(
    input.locationName,
    input.locationAddress,
  );

  const detailLines = formatBookingDetailsLines({
    courseSlug: input.courseSlug,
    scheduleDateLabel: input.scheduleDateLabel,
    ageGroupLabel: input.ageGroupLabel,
    consultationWritingFocusLabel: input.consultationWritingFocusLabel,
    consultationLevelLabel: input.consultationLevelLabel,
    prefixes: input.detailsPrefixes,
  });

  const rows: BookingConfirmationTableRow[] = [
    { label: input.labels.service, value: input.courseLabel.trim() },
  ];

  if (detailLines.length > 0) {
    rows.push({
      label: input.labels.details,
      value: detailLines.join('\n'),
      multiline: true,
    });
  }

  if (scheduleLine) {
    rows.push({ label: input.labels.datetime, value: scheduleLine });
  }

  if (locLine) {
    rows.push({ label: input.labels.location, value: locLine });
  }

  rows.push({
    label: input.labels.payment,
    value: resolvePaymentMethodDisplayForConfirmation(input.paymentMethodCode),
  });
  rows.push({ label: input.labels.total, value: input.totalAmountFormatted });

  return rows;
}
