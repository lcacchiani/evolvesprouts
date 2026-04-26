import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { formatAmountInCurrency } from '@/lib/vendor-spend';
import { CLIENT_DOCUMENT_ASSET_TAG, EXPENSE_ATTACHMENT_ASSET_TAG } from '@/types/assets';
import type {
  LocationSummary,
  ServiceInstance,
  ServiceSummary,
  SessionSlot,
  SessionSlotFormRow,
} from '@/types/services';

import adminSelectableCurrency from '@shared-config/admin-selectable-currency-codes.json';

const SERVICE_TITLE_TIER_SEP = '\u00b7';

/** Service list label: title, space, interpunct, space, tier when tier is set. */
export function formatServiceTitleWithTier(title: string, serviceTier: string | null): string {
  const tier = serviceTier?.trim();
  if (tier) {
    return `${title} ${SERVICE_TITLE_TIER_SEP} ${tier}`;
  }
  return title;
}

/** Short user-visible label for a location (venue name, address, or id). */
export function formatLocationLabel(location: LocationSummary): string {
  const name = location.name?.trim();
  if (name) {
    return name;
  }
  const address = location.address?.trim();
  if (address) {
    return address;
  }
  return location.id;
}

/** Instances table: own title when set, otherwise parent service title (with tier); cohort appended when set. */
export function formatInstanceTableTitle(instance: ServiceInstance): string {
  const own = instance.title?.trim();
  let base: string;
  if (own) {
    base = own;
  } else if (instance.parentServiceTitle) {
    base = formatServiceTitleWithTier(instance.parentServiceTitle, instance.parentServiceTier);
  } else {
    base = '-';
  }
  const cohort = instance.cohort?.trim();
  if (!cohort) {
    return base;
  }
  if (base === '-') {
    return cohort;
  }
  return `${base} ${SERVICE_TITLE_TIER_SEP} ${cohort}`;
}

/** Full venue label: address (when present) plus geographic area name. */
export function formatEntityVenueLocationLabel(location: {
  name?: string | null;
  address?: string | null;
  areaName?: string | null;
  id: string;
}): string {
  const address = location.address?.trim();
  const area = location.areaName?.trim();
  const name = location.name?.trim();
  const parts: string[] = [];
  if (address) {
    parts.push(address);
  } else if (name) {
    parts.push(name);
  }
  if (area) {
    parts.push(area);
  }
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return location.id;
}

const COORD_DISPLAY_FRACTION_DIGITS = 5;

/** Single-line coordinates display for admin location summaries. */
export function formatLocationCoordinatesLabel(lat: number | null, lng: number | null): string {
  if (lat !== null && lng !== null) {
    return `${lat.toFixed(COORD_DISPLAY_FRACTION_DIGITS)}, ${lng.toFixed(COORD_DISPLAY_FRACTION_DIGITS)}`;
  }
  return 'No coordinates set';
}

export function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** User-visible label for an asset tag name (API snake_case). */
export function formatAssetTagDisplayName(tagName: string): string {
  const lower = tagName.toLowerCase();
  if (lower === EXPENSE_ATTACHMENT_ASSET_TAG) {
    return 'Expense';
  }
  if (lower === CLIENT_DOCUMENT_ASSET_TAG) {
    return 'Client';
  }
  return toTitleCase(tagName.toLowerCase());
}

/** Same date/time field choices as the app shell navbar timestamp (local TZ + default locale). */
export const NAVBAR_LOCAL_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  ...NAVBAR_LOCAL_DATETIME_OPTIONS,
  year: 'numeric',
});
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DEFAULT_CURRENCY_LABEL_HKD = 'Hong Kong Dollar';

const ADMIN_SELECTABLE_CURRENCY_CODES = adminSelectableCurrency.codes as readonly string[];

function getAdminSelectableCurrencyCodesOrdered(): string[] {
  const defaultCode = getAdminDefaultCurrencyCode();
  const inAllowlist = ADMIN_SELECTABLE_CURRENCY_CODES.includes(defaultCode);
  if (inAllowlist) {
    return [defaultCode, ...ADMIN_SELECTABLE_CURRENCY_CODES.filter((c) => c !== defaultCode)];
  }
  return [defaultCode, ...ADMIN_SELECTABLE_CURRENCY_CODES];
}

type CurrencyOption = {
  value: string;
  label: string;
};

let cachedCurrencyOptions: CurrencyOption[] | null = null;

function getCurrencyName(code: string): string {
  if (typeof Intl.DisplayNames === 'undefined') {
    return code;
  }

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatEnumLabel(value: string): string {
  return toTitleCase(value.toLowerCase());
}

const SESSION_SLOT_TABLE_DATETIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Session slot start for instances table: `dd Mmm @ HH:mm` in local time (en-GB parts).
 */
export function formatSessionSlotStartsAtDisplay(iso: string | null | undefined): string {
  if (iso == null) {
    return '-';
  }
  const trimmed = iso.trim();
  if (!trimmed) {
    return '-';
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }
  const parts = SESSION_SLOT_TABLE_DATETIME_FORMATTER.formatToParts(parsed);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  if (!day || !month || !hour || !minute) {
    return '-';
  }
  const monthNorm = month.replace(/\.$/, '');
  return `${day} ${monthNorm} @ ${hour}:${minute}`;
}

function sessionSlotSortKey(slot: SessionSlot, index: number): number {
  const o = slot.sortOrder;
  if (typeof o === 'number' && Number.isFinite(o)) {
    return o;
  }
  return index;
}

/** Same ordering as the instances table slot column: `sort_order`, then start time, then index. */
export function orderSessionSlotsForDisplay(slots: SessionSlot[]): SessionSlot[] {
  return slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => {
      const ko = sessionSlotSortKey(a.slot, a.index) - sessionSlotSortKey(b.slot, b.index);
      if (ko !== 0) {
        return ko;
      }
      const ra = a.slot.startsAt?.trim() ?? '';
      const rb = b.slot.startsAt?.trim() ?? '';
      const ta = ra ? new Date(ra).getTime() : NaN;
      const tb = rb ? new Date(rb).getTime() : NaN;
      const fa = Number.isFinite(ta);
      const fb = Number.isFinite(tb);
      if (fa && fb && ta !== tb) {
        return ta - tb;
      }
      if (fa !== fb) {
        return fa ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ slot }) => slot);
}

function collectDistinctLocationLabels(
  locationById: Map<string, LocationSummary>,
  ids: Iterable<string | null | undefined>
): string[] {
  const labels = new Map<string, string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || labels.has(id)) {
      continue;
    }
    const loc = locationById.get(id);
    labels.set(id, loc ? formatLocationLabel(loc) : id);
  }
  return [...labels.values()];
}

/**
 * Distinct venue labels for instance default, session slots, and partner org venues.
 */
export function formatInstanceSlotLocationSummary(
  instance: ServiceInstance,
  locationById: Map<string, LocationSummary>
): string {
  const idSequence: string[] = [];
  const resolved = instance.locationId ?? instance.resolvedLocationId;
  if (resolved?.trim()) {
    idSequence.push(resolved);
  }
  for (const slot of orderSessionSlotsForDisplay(instance.sessionSlots)) {
    if (slot.locationId?.trim()) {
      idSequence.push(slot.locationId);
    }
  }
  for (const partner of instance.partnerOrganizations) {
    if (partner.locationId?.trim()) {
      idSequence.push(partner.locationId);
    }
  }
  const labels = collectDistinctLocationLabels(locationById, idSequence);
  if (labels.length === 0) {
    return '-';
  }
  return labels.join(' · ');
}

/** Timestamp of the earliest slot with a valid `startsAt`, or `null` if none. */
export function getFirstSessionSlotStartTimeMs(slots: SessionSlot[]): number | null {
  const ordered = orderSessionSlotsForDisplay(slots);
  for (const slot of ordered) {
    const raw = slot.startsAt?.trim() ?? '';
    if (!raw) {
      continue;
    }
    const ms = new Date(raw).getTime();
    if (Number.isFinite(ms)) {
      return ms;
    }
  }
  return null;
}

/**
 * Sort instances for the admin table: latest first session start first; instances
 * without slot times last (stable tie-break on id).
 */
export function compareInstancesByFirstSlotStartsDesc(a: ServiceInstance, b: ServiceInstance): number {
  const ta = getFirstSessionSlotStartTimeMs(a.sessionSlots);
  const tb = getFirstSessionSlotStartTimeMs(b.sessionSlots);
  if (ta == null && tb == null) {
    return a.id.localeCompare(b.id);
  }
  if (ta == null) {
    return 1;
  }
  if (tb == null) {
    return -1;
  }
  if (tb !== ta) {
    return tb - ta;
  }
  return a.id.localeCompare(b.id);
}

function parseDecimalAmountString(raw: string | null | undefined): number | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function resolveIsoCurrencyCode(code: string | null | undefined): string {
  const trimmed = code?.trim().toUpperCase() ?? '';
  return trimmed.length === 3 ? trimmed : getAdminDefaultCurrencyCode();
}

/**
 * One-line default pricing for the admin services list (training/event default price;
 * consultation Free, hourly rate, or package price). Amounts use the same currency
 * formatting as the Vendors total spend column ({@link formatAmountInCurrency}).
 */
export function formatServiceListPriceLabel(service: ServiceSummary): string {
  if (service.serviceType === 'training_course') {
    const d = service.trainingDetails;
    if (!d) {
      return '—';
    }
    const amount = parseDecimalAmountString(d.defaultPrice);
    if (amount == null) {
      return '—';
    }
    return formatAmountInCurrency(amount, resolveIsoCurrencyCode(d.defaultCurrency));
  }
  if (service.serviceType === 'event') {
    const d = service.eventDetails;
    if (!d) {
      return '—';
    }
    const amount = parseDecimalAmountString(d.defaultPrice);
    if (amount == null) {
      return '—';
    }
    return formatAmountInCurrency(amount, resolveIsoCurrencyCode(d.defaultCurrency));
  }
  if (service.serviceType === 'consultation') {
    const d = service.consultationDetails;
    if (!d) {
      return '—';
    }
    if (d.pricingModel === 'free') {
      return 'Free';
    }
    if (d.pricingModel === 'hourly') {
      const amount = parseDecimalAmountString(d.defaultHourlyRate);
      if (amount == null) {
        return '—';
      }
      const formatted = formatAmountInCurrency(amount, resolveIsoCurrencyCode(d.defaultCurrency));
      return `${formatted} / hr`;
    }
    if (d.pricingModel === 'package') {
      const amount = parseDecimalAmountString(d.defaultPackagePrice);
      if (amount == null) {
        return '—';
      }
      const formatted = formatAmountInCurrency(amount, resolveIsoCurrencyCode(d.defaultCurrency));
      if (typeof d.defaultPackageSessions === 'number' && d.defaultPackageSessions > 0) {
        return `${formatted} (${d.defaultPackageSessions} sessions)`;
      }
      return formatted;
    }
    return '—';
  }
  return '—';
}

export function getCurrencyOptions(): CurrencyOption[] {
  if (cachedCurrencyOptions) {
    return cachedCurrencyOptions;
  }

  const options = getAdminSelectableCurrencyCodesOrdered().map((code) => {
    if (code === 'HKD') {
      return { value: code, label: `${code} ${DEFAULT_CURRENCY_LABEL_HKD}` };
    }
    return { value: code, label: `${code} ${getCurrencyName(code)}` };
  });

  cachedCurrencyOptions = options;
  return options;
}

/** BCP 47 tags for admin asset content language (matches admin API allowlist). */
export const ADMIN_ASSET_CONTENT_LANGUAGE_TAGS = ['en', 'zh-CN', 'zh-HK'] as const;

const ADMIN_ASSET_CONTENT_LANGUAGE_LABELS: Record<
  (typeof ADMIN_ASSET_CONTENT_LANGUAGE_TAGS)[number],
  string
> = {
  en: 'English',
  'zh-CN': 'Mandarin (Simplified)',
  'zh-HK': 'Cantonese (Hong Kong)',
};

type ContentLanguageOption = {
  value: string;
  label: string;
};

/**
 * Fixed allowlist for admin asset content-language dropdowns (ISO-style BCP 47 tags).
 * Same pattern as {@link getCurrencyOptions} (no module cache — avoids brittle test state).
 */
export function getContentLanguageOptions(): ContentLanguageOption[] {
  return ADMIN_ASSET_CONTENT_LANGUAGE_TAGS.map((tag) => ({
    value: tag,
    label: ADMIN_ASSET_CONTENT_LANGUAGE_LABELS[tag],
  }));
}

/**
 * Match stored API `content_language` to the admin allowlist, or detect unsupported values.
 */
export function matchAdminSelectableContentLanguage(
  value: string | null | undefined
): (typeof ADMIN_ASSET_CONTENT_LANGUAGE_TAGS)[number] | null | 'unrecognized' {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  for (const tag of ADMIN_ASSET_CONTENT_LANGUAGE_TAGS) {
    if (tag.toLowerCase() === lower) {
      return tag;
    }
  }
  return 'unrecognized';
}

/** User-visible label for an asset's stored content_language tag, or raw tag / em dash. */
export function formatAssetContentLanguageLabel(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    return '—';
  }
  const lower = raw.toLowerCase();
  for (const tag of ADMIN_ASSET_CONTENT_LANGUAGE_TAGS) {
    if (tag.toLowerCase() === lower) {
      return ADMIN_ASSET_CONTENT_LANGUAGE_LABELS[tag];
    }
  }
  return raw;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return LOCAL_DATE_TIME_FORMATTER.format(parsedDate);
}

export function formatDateOnly(value: string | null): string {
  if (!value) {
    return '—';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return LOCAL_DATE_FORMATTER.format(parsedDate);
}

export function formatDateForInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Map API ISO instant to `datetime-local` value in the browser's local timezone. */
export function formatIsoForDatetimeLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` only (no offset, no seconds); used for `datetime-local` and strict parsing. */
export const DATETIME_LOCAL_WALL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function parseWallDatetimeLocalToUtcDate(trimmed: string): Date | null {
  if (!DATETIME_LOCAL_WALL_PATTERN.test(trimmed)) {
    return null;
  }
  const [datePart, timePart] = trimmed.split('T');
  const dateSegments = datePart.split('-').map(Number);
  const timeSegments = timePart.split(':').map(Number);
  if (
    dateSegments.length !== 3 ||
    timeSegments.length !== 2 ||
    dateSegments.some((n) => !Number.isFinite(n)) ||
    timeSegments.some((n) => !Number.isFinite(n))
  ) {
    return null;
  }
  const [y, mo, d] = dateSegments;
  const [hh, mm] = timeSegments;
  const parsed = new Date(y, mo - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

/**
 * Parse `datetime-local` wall time (`YYYY-MM-DDTHH:mm` only) and return UTC ISO for the API.
 * Uses explicit `Date(year, monthIndex, …)` construction (no `new Date(string)` for this shape).
 * Strings with offsets, `Z`, or seconds are rejected so callers do not double-shift instants.
 */
export function parseDatetimeLocalToIsoUtc(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) {
    return null;
  }
  const wall = parseWallDatetimeLocalToUtcDate(trimmed);
  if (!wall) {
    return null;
  }
  return wall.toISOString();
}

/**
 * Parse admin date-time input: `YYYY-MM-DDTHH:mm` wall time (explicit local calendar fields),
 * or any other string accepted by `Date` (for example pasted RFC 3339 with `Z` or offset).
 */
export function parseAdminDateTimeInputToIsoUtc(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const wall = parseWallDatetimeLocalToUtcDate(trimmed);
  if (wall) {
    return wall.toISOString();
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

/** True if the string is exactly `YYYY-MM-DDTHH:mm` (not an offset ISO instant). */
export function isDatetimeLocalWallString(value: string): boolean {
  return DATETIME_LOCAL_WALL_PATTERN.test(value.trim());
}

/**
 * Normalize session slot times from the API (UTC ISO) into `datetime-local` wall strings
 * for editors. Values that are already `YYYY-MM-DDTHH:mm` are left unchanged.
 */
export function sessionSlotApiTimesToFormLocals(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
): { startsAtLocal: string | null; endsAtLocal: string | null } {
  const toLocal = (value: string | null | undefined): string | null => {
    if (!value?.trim()) {
      return null;
    }
    const t = value.trim();
    if (DATETIME_LOCAL_WALL_PATTERN.test(t)) {
      return t;
    }
    const formatted = formatIsoForDatetimeLocalInput(t);
    return formatted || null;
  };
  return { startsAtLocal: toLocal(startsAt), endsAtLocal: toLocal(endsAt) };
}

/** Map API session slots to form rows (`startsAtLocal` / `endsAtLocal` are `datetime-local` wall times). */
export function mapSessionSlotsFromApiToForm(slots: SessionSlot[]): SessionSlotFormRow[] {
  return slots.map((slot) => {
    const { startsAtLocal, endsAtLocal } = sessionSlotApiTimesToFormLocals(slot.startsAt, slot.endsAt);
    return {
      id: slot.id,
      instanceId: slot.instanceId,
      locationId: slot.locationId,
      startsAtLocal,
      endsAtLocal,
      sortOrder: slot.sortOrder,
    };
  });
}

export type SessionSlotApiRow = {
  location_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

export type SessionSlotsUtcPayload =
  | { ok: true; session_slots: SessionSlotApiRow[] }
  | { ok: false; message: string };

/**
 * Build `session_slots` for create/update API payloads: only `YYYY-MM-DDTHH:mm` wall values
 * are accepted (rejects offset/Z ISO in form state to avoid double-shifting).
 */
export function buildSessionSlotsUtcPayload(slots: SessionSlotFormRow[]): SessionSlotsUtcPayload {
  const session_slots: SessionSlotApiRow[] = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const startsRaw = (slot.startsAtLocal ?? '').trim();
    const endsRaw = (slot.endsAtLocal ?? '').trim();
    if (!startsRaw && !endsRaw) {
      session_slots.push({
        location_id: slot.locationId,
        starts_at: null,
        ends_at: null,
        sort_order: slot.sortOrder ?? index,
      });
      continue;
    }
    if (!startsRaw || !endsRaw) {
      return {
        ok: false,
        message: 'Each session slot needs both a start time and an end time.',
      };
    }
    if (!isDatetimeLocalWallString(startsRaw) || !isDatetimeLocalWallString(endsRaw)) {
      return {
        ok: false,
        message:
          'Session slot times must use the date and time pickers (local wall format). ' +
          'Remove any pasted offset or Z suffix and pick the slot times again.',
      };
    }
    const starts_at = parseDatetimeLocalToIsoUtc(startsRaw);
    const ends_at = parseDatetimeLocalToIsoUtc(endsRaw);
    if (!starts_at || !ends_at) {
      return {
        ok: false,
        message: 'One or more session slot times are invalid. Check start and end times.',
      };
    }
    if (new Date(starts_at).getTime() >= new Date(ends_at).getTime()) {
      return {
        ok: false,
        message: 'Each session slot must end after it starts.',
      };
    }
    session_slots.push({
      location_id: slot.locationId,
      starts_at,
      ends_at,
      sort_order: slot.sortOrder ?? index,
    });
  }
  return { ok: true, session_slots };
}
