import type { EventsContent } from '@/content';
import temporaryEventsPayload from '@/content/events.json';
import {
  readCandidateText,
  readOptionalText,
  toRecord,
} from '@/content/content-field-utils';
import { type CrmApiClient, buildCrmApiUrl } from '@/lib/crm-api-client';
import { isHttpHref } from '@/lib/url-utils';

type EventStatus = 'open' | 'fully_booked';
type SupportedLocale = 'en' | 'zh-CN' | 'zh-HK';
type EventsSource = 'content' | 'api';

export const EVENTS_API_PATH = '/v1/calendar/events';
const EVENTS_SOURCE_ENV_NAME = 'NEXT_PUBLIC_EVENTS_SOURCE';
const EVENTS_SOURCE_CONTENT: EventsSource = 'content';
const MAX_PAST_EVENTS = 5;

export interface EventCardData {
  id: string;
  title: string;
  summary?: string;
  dateLabel?: string;
  timeLabel?: string;
  costLabel?: string;
  isFreeCost?: boolean;
  locationName?: string;
  locationAddress?: string;
  directionHref?: string;
  ctaHref: string;
  ctaLabel: string;
  tags: string[];
  status: EventStatus;
  timestamp: number | null;
}

const UK_EVENTS_LOCALE = 'en-GB';
const UK_TIME_ZONE = 'Europe/London';
const DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const TIME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function resolveEventsLocale(locale?: string): SupportedLocale {
  if (locale === 'zh-CN' || locale === 'zh-HK') {
    return locale;
  }

  return 'en';
}

function resolveDateTimeLocale(locale: SupportedLocale): string {
  if (locale === 'en') {
    return UK_EVENTS_LOCALE;
  }

  return locale;
}

function formatEnumLikeLabel(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  if (/\s/.test(trimmedValue) || !/[_-]/.test(trimmedValue)) {
    return trimmedValue;
  }

  return trimmedValue
    .split(/[_-]+/)
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1).toLowerCase())
    .join(' ');
}

function getDateFormatter(locale: SupportedLocale): Intl.DateTimeFormat {
  const formatterKey = locale;
  const cachedFormatter = DATE_FORMATTER_CACHE.get(formatterKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const nextFormatter = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: UK_TIME_ZONE,
  });
  DATE_FORMATTER_CACHE.set(formatterKey, nextFormatter);
  return nextFormatter;
}

function getTimeFormatter(locale: SupportedLocale): Intl.DateTimeFormat {
  const formatterKey = locale;
  const cachedFormatter = TIME_FORMATTER_CACHE.get(formatterKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const nextFormatter =
    locale === 'en'
      ? new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: UK_TIME_ZONE,
        })
      : new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: UK_TIME_ZONE,
        });
  TIME_FORMATTER_CACHE.set(formatterKey, nextFormatter);
  return nextFormatter;
}

function sanitizeExternalHref(value: string | undefined): string {
  const href = readOptionalText(value);
  if (!href || !isHttpHref(href)) {
    return '';
  }

  return href;
}

function isGoogleMapsHref(href: string): boolean {
  try {
    const parsedUrl = new URL(href);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    if (hostname === 'maps.app.goo.gl') {
      return true;
    }

    if (!hostname.includes('google.')) {
      return false;
    }

    return pathname === '/' || pathname.startsWith('/maps');
  } catch {
    return false;
  }
}

function sanitizeGoogleMapsHref(value: string | undefined): string {
  const href = sanitizeExternalHref(value);
  if (!href || !isGoogleMapsHref(href)) {
    return '';
  }

  return href;
}

function parseTimestamp(value: string | undefined): number | null {
  const text = readOptionalText(value);
  if (!text) {
    return null;
  }

  const parsedTimestamp = Date.parse(text);
  if (Number.isNaN(parsedTimestamp)) {
    return null;
  }

  return parsedTimestamp;
}

function formatUtcDateLabel(isoDateTime: string, locale: SupportedLocale): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return getDateFormatter(locale).format(date);
}

function formatUtcTimeLabel(isoDateTime: string, locale: SupportedLocale): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return getTimeFormatter(locale).format(date);
}

function appendTimeZoneLabel(
  timeLabel: string | undefined,
  timeZoneLabel: string | undefined,
): string | undefined {
  const normalizedTimeLabel = readOptionalText(timeLabel);
  if (!normalizedTimeLabel) {
    return undefined;
  }

  const normalizedTimeZoneLabel = readOptionalText(timeZoneLabel);
  if (!normalizedTimeZoneLabel) {
    return normalizedTimeLabel;
  }

  if (
    normalizedTimeLabel
      .toLowerCase()
      .includes(normalizedTimeZoneLabel.toLowerCase())
  ) {
    return normalizedTimeLabel;
  }

  return `${normalizedTimeLabel} ${normalizedTimeZoneLabel}`;
}

function resolveDateTimeDetails(
  record: Record<string, unknown>,
  locale: SupportedLocale,
): {
  dateLabel?: string;
  timeLabel?: string;
  timeZoneLabel?: string;
  timestamp: number | null;
} {
  const dateEntries = Array.isArray(record.dates) ? record.dates : [];
  const firstDateRecord = dateEntries
    .map((entry) => toRecord(entry))
    .find((entry): entry is Record<string, unknown> => entry !== null);

  if (!firstDateRecord) {
    return { timestamp: null };
  }

  const startDateTime = readCandidateText(firstDateRecord, [
    'start_datetime',
    'startDateTime',
    'start',
  ]);
  const endDateTime = readCandidateText(firstDateRecord, [
    'end_datetime',
    'endDateTime',
    'end',
  ]);
  const timeZoneLabel = readCandidateText(firstDateRecord, [
    'timezone',
    'timeZone',
    'tz',
  ]);

  if (!startDateTime) {
    return { timestamp: null };
  }

  const dateLabel = formatUtcDateLabel(startDateTime, locale);
  const startTimeLabel = formatUtcTimeLabel(startDateTime, locale);
  const endTimeLabel = endDateTime ? formatUtcTimeLabel(endDateTime, locale) : '';
  const timeLabel =
    startTimeLabel && endTimeLabel
      ? `${startTimeLabel} - ${endTimeLabel}`
      : startTimeLabel;

  return {
    dateLabel: dateLabel || undefined,
    timeLabel: timeLabel || undefined,
    timeZoneLabel: timeZoneLabel || undefined,
    timestamp: parseTimestamp(startDateTime),
  };
}

function buildEventsApiUrl(crmApiBaseUrl: string): string {
  return buildCrmApiUrl(crmApiBaseUrl, EVENTS_API_PATH);
}

function resolveEventsSource(): EventsSource {
  const configuredSource = process.env[EVENTS_SOURCE_ENV_NAME]?.trim().toLowerCase() ?? '';
  if (configuredSource === EVENTS_SOURCE_CONTENT) {
    return EVENTS_SOURCE_CONTENT;
  }

  return 'api';
}

export function shouldUseTemporaryEventsContentSource(): boolean {
  return resolveEventsSource() === EVENTS_SOURCE_CONTENT;
}

function normalizeLocationLabel(value: string | undefined): string | undefined {
  const normalizedValue = readOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }

  const normalizedKey = normalizedValue.toLowerCase();

  if (normalizedKey === 'virtual') {
    return 'Virtual';
  }

  if (normalizedKey === 'physical') {
    return 'In Person';
  }

  return formatEnumLikeLabel(normalizedValue);
}

function readFirstCandidateValue(
  record: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (Object.hasOwn(record, key)) {
      return record[key];
    }
  }

  return undefined;
}

function parseNumericText(value: string): number | null {
  const normalizedValue = value.replaceAll(',', '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function formatNumberWithThousandsSeparators(value: number): string {
  return new Intl.NumberFormat('en-US', {
    useGrouping: true,
    maximumFractionDigits: 20,
  }).format(value);
}
function resolveEventCost(
  record: Record<string, unknown>,
  content: EventsContent,
): { costLabel?: string; isFreeCost: boolean } {
  const explicitCostLabel = readCandidateText(record, [
    'costLabel',
    'cost_label',
    'priceLabel',
    'price_label',
    'priceDisplay',
    'price_display',
    'costDisplay',
    'cost_display',
    'feeLabel',
    'fee_label',
    'amountLabel',
    'amount_label',
  ]);
  if (explicitCostLabel) {
    const explicitAmount = parseNumericText(explicitCostLabel);
    if (explicitAmount === 0) {
      return { costLabel: content.card.freeLabel, isFreeCost: true };
    }

    if (explicitAmount !== null) {
      return {
        costLabel: formatNumberWithThousandsSeparators(explicitAmount),
        isFreeCost: false,
      };
    }
    return { costLabel: explicitCostLabel, isFreeCost: false };
  }

  const rawAmount = readFirstCandidateValue(record, [
    'price',
    'cost',
    'amount',
    'fee',
    'eventPrice',
    'event_price',
  ]);
  const currencyPrefix = readCandidateText(record, [
    'currencySymbol',
    'currency_symbol',
    'currencyPrefix',
    'currency_prefix',
    'currencyCode',
    'currency_code',
    'currency',
    'priceCurrency',
    'price_currency',
  ]);

  const amountText =
    typeof rawAmount === 'number' && Number.isFinite(rawAmount)
      ? String(rawAmount)
      : readOptionalText(rawAmount);
  if (!amountText) {
    return { isFreeCost: false };
  }

  const numericAmount = parseNumericText(amountText);
  if (numericAmount === 0) {
    return { costLabel: content.card.freeLabel, isFreeCost: true };
  }

  const formattedAmountText =
    numericAmount === null
      ? amountText
      : formatNumberWithThousandsSeparators(numericAmount);

  if (numericAmount !== null && currencyPrefix) {
    return { costLabel: `${currencyPrefix}${formattedAmountText}`, isFreeCost: false };
  }

  return { costLabel: formattedAmountText, isFreeCost: false };
}

export async function fetchEventsPayload(
  crmApiClient: CrmApiClient | null,
  signal: AbortSignal,
): Promise<unknown> {
  if (shouldUseTemporaryEventsContentSource()) {
    return temporaryEventsPayload;
  }
  if (!crmApiClient) {
    throw new Error('CRM API client is not configured');
  }

  return crmApiClient.request({
    endpointPath: EVENTS_API_PATH,
    method: 'GET',
    signal,
  });
}

export function resolveEventsApiUrl(
  crmApiBaseUrl: string,
): string {
  return buildEventsApiUrl(crmApiBaseUrl);
}

function findEventsArray(payload: unknown, depth = 0): unknown[] {
  if (depth > 6) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const record = toRecord(payload);
  if (!record) {
    return [];
  }

  const directArrayKeys = ['events', 'items', 'results', 'records'];
  for (const key of directArrayKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  const nestedKeys = ['data', 'payload', 'result', 'response'];
  for (const key of nestedKeys) {
    const nested = findEventsArray(record[key], depth + 1);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function readTagList(record: Record<string, unknown>): string[] {
  const tagKeys = ['tags', 'chips', 'categories'];
  const tags: string[] = [];
  const seenTags = new Set<string>();

  for (const key of tagKeys) {
    const value = record[key];
    const collectedTags: string[] = [];

    if (Array.isArray(value)) {
      collectedTags.push(
        ...value
        .map((item) => {
          if (typeof item === 'string') {
            return readOptionalText(item);
          }
          const itemRecord = toRecord(item);
          if (!itemRecord) {
            return undefined;
          }

          return readCandidateText(itemRecord, ['label', 'title', 'name']);
        })
        .filter((item): item is string => Boolean(item)),
      );
    }

    if (typeof value === 'string') {
      collectedTags.push(
        ...value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry): entry is string => Boolean(entry)),
      );
    }

    const valueRecord = toRecord(value);
    if (valueRecord) {
      collectedTags.push(
        ...Object.values(valueRecord)
          .map((entry) => (typeof entry === 'string' ? readOptionalText(entry) : ''))
          .filter((entry): entry is string => Boolean(entry)),
      );
    }

    for (const tag of collectedTags) {
      const normalizedTag = formatEnumLikeLabel(tag);
      if (!normalizedTag) {
        continue;
      }
      if (!seenTags.has(normalizedTag)) {
        seenTags.add(normalizedTag);
        tags.push(normalizedTag);
      }
    }
  }

  return tags;
}

function resolveEventStatus(record: Record<string, unknown>): EventStatus {
  const statusText = readCandidateText(record, [
    'status',
    'bookingStatus',
    'availability',
  ]);

  if (statusText) {
    const normalizedStatus = statusText.toLowerCase();
    if (
      normalizedStatus.includes('full') ||
      normalizedStatus.includes('booked') ||
      normalizedStatus.includes('sold')
    ) {
      return 'fully_booked';
    }
  }

  const fullStateKeys = ['isFullyBooked', 'fullyBooked', 'soldOut', 'isSoldOut'];
  for (const key of fullStateKeys) {
    if (record[key] === true) {
      return 'fully_booked';
    }
  }

  if (record.is_fully_booked === true) {
    return 'fully_booked';
  }

  return 'open';
}

function normalizeEventCard(
  value: unknown,
  index: number,
  content: EventsContent,
  locale: SupportedLocale,
): EventCardData | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const title = readCandidateText(record, ['title', 'name', 'eventTitle']);
  if (!title) {
    return null;
  }

  const dateTimeDetails = resolveDateTimeDetails(record, locale);
  const summary = readCandidateText(record, [
    'summary',
    'description',
    'details',
    'excerpt',
    'body',
  ]);

  const dateLabel = readCandidateText(record, [
    'dateLabel',
    'date',
    'eventDate',
    'startDateLabel',
    'dateDisplay',
  ]) ?? dateTimeDetails.dateLabel;
  const rawTimeLabel = readCandidateText(record, [
    'timeLabel',
    'time',
    'eventTime',
    'startTimeLabel',
    'timeDisplay',
  ]) ?? dateTimeDetails.timeLabel;
  const timeZoneLabel =
    readCandidateText(record, ['timezone', 'timeZone', 'tz'])
    ?? dateTimeDetails.timeZoneLabel;
  const timeLabel = appendTimeZoneLabel(rawTimeLabel, timeZoneLabel);

  const timestamp =
    parseTimestamp(
      readCandidateText(record, [
        'startsAt',
        'startAt',
        'startDateTime',
        'startDate',
        'dateIso',
      ]),
    ) ??
    dateTimeDetails.timestamp ??
    parseTimestamp(dateLabel);

  const locationName =
    readCandidateText(record, [
      'locationName',
      'venue',
      'address',
    ]) ?? normalizeLocationLabel(readOptionalText(record.location));
  const locationAddress = readCandidateText(record, [
    'locationAddress',
    'venueAddress',
  ]);
  const directionHref = sanitizeGoogleMapsHref(
    readCandidateText(record, [
      'directionHref',
      'directionUrl',
      'mapHref',
      'mapUrl',
      'mapsUrl',
      'locationMapUrl',
      'locationUrl',
      'address_url',
    ]),
  );

  const ctaHref = sanitizeExternalHref(
    readCandidateText(record, [
      'ctaHref',
      'ctaUrl',
      'bookingUrl',
      'registrationUrl',
      'registerUrl',
      'href',
      'url',
      'link',
      'address_url',
    ]),
  );
  const ctaLabel =
    readCandidateText(record, ['ctaLabel', 'buttonLabel', 'actionLabel']) ??
    content.card.ctaLabel;

  const rawId = readCandidateText(record, ['id', 'eventId', 'slug']) ?? '';
  const fallbackId = `${title}-${dateLabel ?? ''}-${index}`;
  const status = resolveEventStatus(record);
  const tags = readTagList(record);
  const { costLabel, isFreeCost } = resolveEventCost(record, content);

  return {
    id: rawId || fallbackId,
    title,
    summary,
    dateLabel,
    timeLabel,
    costLabel,
    isFreeCost,
    locationName,
    locationAddress:
      locationAddress && locationAddress !== locationName
        ? locationAddress
        : undefined,
    directionHref: directionHref || undefined,
    ctaHref,
    ctaLabel,
    tags,
    status,
    timestamp,
  };
}

export function normalizeEvents(
  payload: unknown,
  content: EventsContent,
  locale?: string,
): EventCardData[] {
  const eventsArray = findEventsArray(payload);
  const normalizedLocale = resolveEventsLocale(locale);

  return eventsArray
    .map((item, index) => normalizeEventCard(item, index, content, normalizedLocale))
    .filter((item): item is EventCardData => item !== null);
}

export function sortUpcomingEvents(
  events: EventCardData[],
): EventCardData[] {
  const entries = events.map((event, index) => ({ event, index }));
  const now = Date.now();

  const upcomingEntries = entries.filter((entry) => {
    const timestamp = entry.event.timestamp;
    return timestamp === null || timestamp >= now;
  });
  upcomingEntries.sort((left, right) => {
    const leftValue = left.event.timestamp;
    const rightValue = right.event.timestamp;

    if (leftValue === null && rightValue === null) {
      return left.index - right.index;
    }
    if (leftValue === null) {
      return 1;
    }
    if (rightValue === null) {
      return -1;
    }
    if (leftValue === rightValue) {
      return left.index - right.index;
    }

    return leftValue - rightValue;
  });
  return upcomingEntries.map((entry) => entry.event);
}

export function sortPastEvents(
  events: EventCardData[],
): EventCardData[] {
  const entries = events.map((event, index) => ({ event, index }));
  const now = Date.now();
  const pastEntries = entries.filter((entry) => {
    const timestamp = entry.event.timestamp;
    return timestamp !== null && timestamp < now;
  });

  pastEntries.sort((left, right) => {
    const leftValue = left.event.timestamp;
    const rightValue = right.event.timestamp;
    if (leftValue === null || rightValue === null) {
      return left.index - right.index;
    }
    if (leftValue === rightValue) {
      return left.index - right.index;
    }

    return rightValue - leftValue;
  });

  return pastEntries
    .slice(0, MAX_PAST_EVENTS)
    .map((entry) => entry.event);
}

export function sortEvents(
  events: EventCardData[],
): EventCardData[] {
  return sortUpcomingEvents(events);
}
