import type { EventsContent } from '@/content';
import temporaryEventsPayload from '@/content/events.json';
import myBestAuntieTrainingCourseContent from '@/content/my-best-auntie-training-courses.json';
import {
  readCandidateText,
  readOptionalText,
  toRecord,
} from '@/content/content-field-utils';
import { type CrmApiClient, buildCrmApiUrl } from '@/lib/crm-api-client';
import { ROUTES } from '@/lib/routes';
import { isHttpHref } from '@/lib/url-utils';

type EventStatus = 'open' | 'fully_booked';
type SupportedLocale = 'en' | 'zh-CN' | 'zh-HK';
type EventsSource = 'content' | 'api';

export const EVENTS_API_PATH = '/v1/calendar/events';
const EVENTS_SOURCE_ENV_NAME = 'NEXT_PUBLIC_EVENTS_SOURCE';
const EVENTS_SOURCE_CONTENT: EventsSource = 'content';
const MAX_PAST_EVENTS = 5;
const BOOKING_SYSTEM_QUERY_PARAM = 'booking_system';
const EVENT_BOOKING_SYSTEM = 'event-booking';
const MY_BEST_AUNTIE_BOOKING_SYSTEM = 'my-best-auntie-booking';
const MY_BEST_AUNTIE_BOOKING_HASH = 'my-best-auntie-booking';
const COHORT_VALUE_PATTERN = /^(\d{2})-(\d{2})$/;

interface EventBookingDatePart {
  id: string;
  startDateTime: string;
  endDateTime: string;
  description: string;
}

export interface EventBookingModalPayload {
  variant: 'event';
  bookingSystem: typeof EVENT_BOOKING_SYSTEM;
  title: string;
  subtitle: string;
  originalAmount: number;
  locationName: string;
  locationAddress: string;
  directionHref: string;
  dateParts: EventBookingDatePart[];
  selectedDateLabel: string;
  selectedDateStartTime: string;
}

interface MyBestAuntieEventCohortDate {
  id: string;
  start_datetime: string;
  end_datetime: string;
}

export interface MyBestAuntieEventCohort {
  id: string;
  age_group: string;
  title: string;
  description: string;
  cohort: string;
  spaces_total: number;
  spaces_left: number;
  is_fully_booked: boolean;
  price: number;
  currency: string;
  location: string;
  booking_system: string;
  tags: string[];
  categories: string[];
  location_name: string;
  location_address: string;
  location_url: string;
  dates: MyBestAuntieEventCohortDate[];
}

export interface MyBestAuntieBookingModalPayload {
  variant: 'my-best-auntie';
  bookingSystem: typeof MY_BEST_AUNTIE_BOOKING_SYSTEM;
  selectedAgeGroupLabel: string;
  selectedCohortDateLabel: string;
  selectedCohort: MyBestAuntieEventCohort;
}

export type EventCardBookingModalPayload =
  | EventBookingModalPayload
  | MyBestAuntieBookingModalPayload;

export interface EventCardData {
  id: string;
  title: string;
  summary?: string;
  dateLabel?: string;
  timeLabel?: string;
  costLabel?: string;
  isFreeCost?: boolean;
  isVirtualEvent: boolean;
  locationName?: string;
  locationAddress?: string;
  directionHref?: string;
  ctaHref: string;
  ctaLabel: string;
  tags: string[];
  partners?: string[];
  status: EventStatus;
  timestamp: number | null;
  bookingSystem?: string;
  bookingModalPayload?: EventCardBookingModalPayload;
}

export interface LandingPageHeroEventContent {
  title: string;
  startDateTime?: string;
  endDateTime?: string;
  locationLabel?: string;
  partners?: string[];
  categoryChips: string[];
}

export interface LandingPageBookingEventContent {
  status: EventStatus;
  bookingPayload: EventBookingModalPayload | null;
  ctaPriceLabel?: string;
}

export interface LandingPageStructuredDataContent {
  eventName: string;
  description: string;
  startDate: string;
  endDate?: string;
  locationName?: string;
  locationAddress?: string;
  offerPrice?: string;
  offerCurrency?: string;
  offerAvailability: 'InStock' | 'SoldOut';
}

const UK_EVENTS_LOCALE = 'en-GB';
const DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const TIME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const TIME_ZONE_NAME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

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

  // Preserve numeric ranges (for example, "1-4") used as age-group tags.
  if (/^\d+\s*-\s*\d+$/.test(trimmedValue)) {
    return trimmedValue.replace(/\s*-\s*/g, '-');
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
        })
      : new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
  TIME_FORMATTER_CACHE.set(formatterKey, nextFormatter);
  return nextFormatter;
}

function getTimeZoneNameFormatter(locale: SupportedLocale): Intl.DateTimeFormat {
  const formatterKey = locale;
  const cachedFormatter = TIME_ZONE_NAME_FORMATTER_CACHE.get(formatterKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const nextFormatter = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  TIME_ZONE_NAME_FORMATTER_CACHE.set(formatterKey, nextFormatter);
  return nextFormatter;
}

function sanitizeExternalHref(value: string | undefined): string {
  const href = readOptionalText(value);
  if (!href || !isHttpHref(href)) {
    return '';
  }

  return href;
}

function localizeRoutePath(path: string, locale: SupportedLocale): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === '/') {
    return `/${locale}`;
  }

  return `/${locale}${normalizedPath}`;
}

function resolveBookingSystemCtaHref(
  bookingSystemValue: string | undefined,
  locale: SupportedLocale,
): string {
  const bookingSystem = readOptionalText(bookingSystemValue);
  if (!bookingSystem) {
    return '';
  }

  if (bookingSystem === EVENT_BOOKING_SYSTEM) {
    const localizedEventsPath = localizeRoutePath(ROUTES.events, locale);
    return `${localizedEventsPath}?${BOOKING_SYSTEM_QUERY_PARAM}=${EVENT_BOOKING_SYSTEM}`;
  }

  if (bookingSystem !== MY_BEST_AUNTIE_BOOKING_SYSTEM) {
    return '';
  }

  const localizedMyBestAuntiePath = localizeRoutePath(
    ROUTES.servicesMyBestAuntieTrainingCourse,
    locale,
  );

  return `${localizedMyBestAuntiePath}?${BOOKING_SYSTEM_QUERY_PARAM}=${MY_BEST_AUNTIE_BOOKING_SYSTEM}#${MY_BEST_AUNTIE_BOOKING_HASH}`;
}

function formatCohortValue(value: string): string {
  const trimmedValue = value.trim();
  const match = COHORT_VALUE_PATTERN.exec(trimmedValue);
  if (!match) {
    return trimmedValue;
  }

  const monthNumber = Number(match[1]);
  const yearSuffix = Number(match[2]);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return trimmedValue;
  }

  if (!Number.isInteger(yearSuffix)) {
    return trimmedValue;
  }

  const year = 2000 + yearSuffix;
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return `${monthLabel}, ${year}`;
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

function resolveNumericCandidate(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  const value = readFirstCandidateValue(record, keys);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const textValue = readOptionalText(value);
  if (!textValue) {
    return null;
  }

  return parseNumericText(textValue);
}

function resolveStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? readOptionalText(entry) : undefined))
    .filter((entry): entry is string => Boolean(entry));
}

function resolvePartnerSlugs(value: unknown): string[] {
  const slugs = resolveStringList(value)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[a-z0-9-]+$/.test(entry));

  return Array.from(new Set(slugs));
}

function resolveBookingDateParts(
  record: Record<string, unknown>,
  defaultDescription: string,
): EventBookingDatePart[] {
  const dateEntries = Array.isArray(record.dates) ? record.dates : [];

  return dateEntries
    .map((entry, index) => {
      const dateRecord = toRecord(entry);
      if (!dateRecord) {
        return null;
      }

      const startDateTime = readCandidateText(dateRecord, [
        'start_datetime',
        'startDateTime',
        'start',
      ]) ?? '';
      const endDateTime = readCandidateText(dateRecord, [
        'end_datetime',
        'endDateTime',
        'end',
      ]) ?? '';
      const id = readCandidateText(dateRecord, ['id']) ?? `part-${index + 1}`;
      if (!startDateTime) {
        return null;
      }

      return {
        id,
        startDateTime,
        endDateTime,
        description: index === 0 ? defaultDescription : '',
      };
    })
    .filter((entry): entry is EventBookingDatePart => entry !== null);
}

function buildEventBookingModalPayload(
  record: Record<string, unknown>,
  locale: SupportedLocale,
  title: string,
  summary: string | undefined,
  locationName: string | undefined,
  locationAddress: string | undefined,
  directionHref: string,
): EventBookingModalPayload {
  const dateParts = resolveBookingDateParts(record, summary ?? '');
  const selectedDateStartTime = dateParts[0]?.startDateTime ?? '';
  const selectedDateLabel =
    formatUtcDateLabel(selectedDateStartTime, locale) || title;
  const originalAmount = resolveNumericCandidate(record, [
    'price',
    'cost',
    'amount',
    'fee',
    'eventPrice',
    'event_price',
  ]) ?? 0;

  return {
    variant: 'event',
    bookingSystem: EVENT_BOOKING_SYSTEM,
    title,
    subtitle: summary ?? '',
    originalAmount,
    locationName: locationName ?? '',
    locationAddress: locationAddress ?? '',
    directionHref,
    dateParts,
    selectedDateLabel,
    selectedDateStartTime,
  };
}

function buildMyBestAuntieBookingModalPayload(
  record: Record<string, unknown>,
): MyBestAuntieBookingModalPayload | null {
  const id = readCandidateText(record, ['id', 'eventId', 'slug']) ?? '';
  const ageGroup = readCandidateText(record, ['age_group']) ?? '';
  const cohortValue = readCandidateText(record, ['cohort']) ?? '';
  if (!id || !ageGroup || !cohortValue) {
    return null;
  }

  const title = readCandidateText(record, ['title']) ?? '';
  const description = readCandidateText(record, ['description']) ?? '';
  const spacesTotal = resolveNumericCandidate(record, ['spaces_total']) ?? 0;
  const spacesLeft = resolveNumericCandidate(record, ['spaces_left']) ?? 0;
  const price = resolveNumericCandidate(record, ['price']) ?? 0;
  const currency = readCandidateText(record, ['currency']) ?? 'HKD';
  const location = readCandidateText(record, ['location']) ?? 'physical';
  const locationAddress = readCandidateText(record, [
    'location_address',
    'locationAddress',
    'address',
  ]) ?? '';
  const locationName = readCandidateText(record, [
    'location_name',
    'locationName',
    'venue',
  ]) ?? locationAddress;
  const locationUrl = sanitizeGoogleMapsHref(
    readCandidateText(record, ['location_url', 'locationUrl', 'address_url']),
  );
  const dates = resolveBookingDateParts(record, '')
    .map((part) => {
      return {
        id: part.id,
        start_datetime: part.startDateTime,
        end_datetime: part.endDateTime,
      };
    });
  if (dates.length === 0) {
    return null;
  }

  const selectedCohort: MyBestAuntieEventCohort = {
    id,
    age_group: ageGroup,
    title,
    description,
    cohort: cohortValue,
    spaces_total: spacesTotal,
    spaces_left: spacesLeft,
    is_fully_booked: resolveEventStatus(record) === 'fully_booked',
    price,
    currency,
    location,
    booking_system: MY_BEST_AUNTIE_BOOKING_SYSTEM,
    tags: resolveStringList(record.tags),
    categories: resolveStringList(record.categories),
    location_name: locationName,
    location_address: locationAddress,
    location_url: locationUrl,
    dates,
  };

  return {
    variant: 'my-best-auntie',
    bookingSystem: MY_BEST_AUNTIE_BOOKING_SYSTEM,
    selectedAgeGroupLabel: ageGroup,
    selectedCohortDateLabel: formatCohortValue(cohortValue),
    selectedCohort,
  };
}

function resolveBookingModalPayload(
  record: Record<string, unknown>,
  bookingSystem: string | undefined,
  locale: SupportedLocale,
  title: string,
  summary: string | undefined,
  locationName: string | undefined,
  locationAddress: string | undefined,
  directionHref: string,
): EventCardBookingModalPayload | undefined {
  if (bookingSystem === EVENT_BOOKING_SYSTEM) {
    return buildEventBookingModalPayload(
      record,
      locale,
      title,
      summary,
      locationName,
      locationAddress,
      directionHref,
    );
  }

  if (bookingSystem === MY_BEST_AUNTIE_BOOKING_SYSTEM) {
    return buildMyBestAuntieBookingModalPayload(record) ?? undefined;
  }

  return undefined;
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

function formatUtcTimeZoneLabel(isoDateTime: string, locale: SupportedLocale): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timeZoneNamePart = getTimeZoneNameFormatter(locale)
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')
    ?.value;

  return readOptionalText(timeZoneNamePart) ?? '';
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

function extractTrailingLocationSegment(value: string | undefined): string | undefined {
  const normalizedValue = readOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }

  const lastCommaIndex = normalizedValue.lastIndexOf(',');
  if (lastCommaIndex < 0) {
    return normalizedValue;
  }

  const trailingSegment = normalizedValue.slice(lastCommaIndex + 1).trim();
  return trailingSegment || normalizedValue;
}

function dedupeChipLabels(chips: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const uniqueChips: string[] = [];

  for (const value of chips) {
    const normalizedValue = readOptionalText(value);
    if (!normalizedValue) {
      continue;
    }
    if (seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    uniqueChips.push(normalizedValue);
  }

  return uniqueChips;
}

function readLandingPageCategoryChips(
  record: Record<string, unknown>,
): string[] {
  const value = record.categories;
  const categories: string[] = [];

  if (Array.isArray(value)) {
    categories.push(
      ...value
        .map((entry) => {
          if (typeof entry === 'string') {
            return readOptionalText(entry);
          }
          const entryRecord = toRecord(entry);
          if (!entryRecord) {
            return undefined;
          }
          return readCandidateText(entryRecord, ['label', 'title', 'name']);
        })
        .filter((entry): entry is string => Boolean(entry)),
    );
  } else if (typeof value === 'string') {
    categories.push(
      ...value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry): entry is string => Boolean(entry)),
    );
  } else {
    const valueRecord = toRecord(value);
    if (valueRecord) {
      categories.push(
        ...Object.values(valueRecord)
          .map((entry) => (typeof entry === 'string' ? readOptionalText(entry) : undefined))
          .filter((entry): entry is string => Boolean(entry)),
      );
    }
  }

  return dedupeChipLabels(categories);
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
  const timeZoneLabel = formatUtcTimeZoneLabel(startDateTime, locale);

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

function normalizeLocationLabel(
  value: string | undefined,
  content: EventsContent,
): string | undefined {
  const normalizedValue = readOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }

  const normalizedKey = normalizedValue.toLowerCase();

  if (normalizedKey === 'virtual') {
    return content.locationTypeLabels.virtual;
  }

  if (normalizedKey === 'physical') {
    return content.locationTypeLabels.inPerson;
  }

  return formatEnumLikeLabel(normalizedValue);
}

function isVirtualLocationType(value: string | undefined): boolean {
  const normalizedValue = readOptionalText(value)?.toLowerCase();
  return normalizedValue === 'virtual';
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

function normalizeCurrencyPrefix(value: string | undefined): string | undefined {
  const normalizedValue = readOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue.toUpperCase() === 'HKD') {
    return 'HK$';
  }

  return normalizedValue;
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
  const normalizedCurrencyPrefix = normalizeCurrencyPrefix(currencyPrefix);

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

  if (numericAmount !== null && normalizedCurrencyPrefix) {
    return { costLabel: `${normalizedCurrencyPrefix}${formattedAmountText}`, isFreeCost: false };
  }

  return { costLabel: formattedAmountText, isFreeCost: false };
}

function formatLandingPageEventCtaPriceLabel(
  record: Record<string, unknown>,
): string | undefined {
  const amount = resolveNumericCandidate(record, [
    'price',
    'cost',
    'amount',
    'fee',
    'eventPrice',
    'event_price',
  ]);
  if (amount === null) {
    return undefined;
  }

  const formattedAmount = formatNumberWithThousandsSeparators(amount);
  const currencyPrefix = normalizeCurrencyPrefix(
    readCandidateText(record, [
      'currencySymbol',
      'currency_symbol',
      'currencyPrefix',
      'currency_prefix',
      'currencyCode',
      'currency_code',
      'currency',
      'priceCurrency',
      'price_currency',
    ]),
  );

  if (currencyPrefix) {
    return `${currencyPrefix}${formattedAmount}`;
  }

  return formattedAmount;
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

function findLandingPageEventRecord(slug: string): Record<string, unknown> | null {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  for (const entry of findEventsArray(temporaryEventsPayload)) {
    const record = toRecord(entry);
    if (!record) {
      continue;
    }

    const landingPageSlug = readCandidateText(record, ['landing_page', 'landingPage']);
    if (!landingPageSlug) {
      continue;
    }

    if (landingPageSlug.trim().toLowerCase() === normalizedSlug) {
      return record;
    }
  }

  return null;
}

function findFirstEventDateRecord(
  eventRecord: Record<string, unknown>,
): Record<string, unknown> | null {
  const dateEntries = Array.isArray(eventRecord.dates) ? eventRecord.dates : [];
  return dateEntries
    .map((entry) => toRecord(entry))
    .find((entry): entry is Record<string, unknown> => entry !== null) ?? null;
}

function normalizeEventsFromArray(
  eventsArray: unknown[],
  content: EventsContent,
  locale: SupportedLocale,
): EventCardData[] {
  return eventsArray
    .map((item, index) => normalizeEventCard(item, index, content, locale))
    .filter((item): item is EventCardData => item !== null);
}

function resolveEventsArrayForEventsPage(payload: unknown): unknown[] {
  if (!shouldUseTemporaryEventsContentSource()) {
    return findEventsArray(payload);
  }

  return [
    ...findEventsArray(payload),
    ...findEventsArray(myBestAuntieTrainingCourseContent),
  ];
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
  const timeZoneLabel = dateTimeDetails.timeZoneLabel;
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
      'location_name',
      'locationName',
      'venue',
      'location_address',
      'locationAddress',
      'address',
    ]) ?? normalizeLocationLabel(readOptionalText(record.location), content);
  const isVirtualEvent = isVirtualLocationType(
    readCandidateText(record, [
      'locationType',
      'location_type',
      'location',
      'venueType',
      'venue_type',
    ]),
  );
  const locationAddress = readCandidateText(record, [
    'location_address',
    'locationAddress',
    'venueAddress',
    'address',
  ]);
  const directionHref = sanitizeGoogleMapsHref(
    readCandidateText(record, [
      'location_url',
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
  const bookingSystem = readOptionalText(record.booking_system) ?? undefined;
  const bookingModalPayload = resolveBookingModalPayload(
    record,
    bookingSystem,
    locale,
    title,
    summary,
    locationName,
    locationAddress,
    directionHref,
  );

  const ctaHref =
    resolveBookingSystemCtaHref(bookingSystem, locale) ||
    sanitizeExternalHref(readOptionalText(record.external_url));
  const ctaLabel =
    readCandidateText(record, ['ctaLabel', 'buttonLabel', 'actionLabel']) ??
    content.card.ctaLabel;

  const rawId = readCandidateText(record, ['id', 'eventId', 'slug']) ?? '';
  const fallbackId = `${title}-${dateLabel ?? ''}-${index}`;
  const status = resolveEventStatus(record);
  const tags = readTagList(record);
  const partners = resolvePartnerSlugs(record.partners);
  const { costLabel, isFreeCost } = resolveEventCost(record, content);

  return {
    id: rawId || fallbackId,
    title,
    summary,
    dateLabel,
    timeLabel,
    costLabel,
    isFreeCost,
    isVirtualEvent,
    locationName,
    locationAddress:
      locationAddress && locationAddress !== locationName
        ? locationAddress
        : undefined,
    directionHref: directionHref || undefined,
    ctaHref,
    ctaLabel,
    tags,
    partners: partners.length > 0 ? partners : undefined,
    status,
    timestamp,
    bookingSystem,
    bookingModalPayload,
  };
}

export function normalizeEvents(
  payload: unknown,
  content: EventsContent,
  locale?: string,
): EventCardData[] {
  const normalizedLocale = resolveEventsLocale(locale);
  const eventsArray = findEventsArray(payload);

  return normalizeEventsFromArray(eventsArray, content, normalizedLocale);
}

export function normalizeEventsForEventsPage(
  payload: unknown,
  content: EventsContent,
  locale?: string,
): EventCardData[] {
  const normalizedLocale = resolveEventsLocale(locale);
  const eventsArray = resolveEventsArrayForEventsPage(payload);

  return normalizeEventsFromArray(eventsArray, content, normalizedLocale);
}

export function getLandingPageHeroEventContent(
  slug: string,
): LandingPageHeroEventContent | null {
  const eventRecord = findLandingPageEventRecord(slug);
  if (!eventRecord) {
    return null;
  }

  const title = readCandidateText(eventRecord, ['title', 'name', 'eventTitle']);
  if (!title) {
    return null;
  }

  const firstDateRecord = findFirstEventDateRecord(eventRecord);
  const startDateTime = firstDateRecord
    ? readCandidateText(firstDateRecord, ['start_datetime', 'startDateTime', 'start'])
    : undefined;
  const endDateTime = firstDateRecord
    ? readCandidateText(firstDateRecord, ['end_datetime', 'endDateTime', 'end'])
    : undefined;
  const locationSource =
    readCandidateText(eventRecord, [
      'location_address',
      'locationAddress',
      'venueAddress',
      'address',
      'location_name',
      'locationName',
      'venue',
    ]) ?? readOptionalText(eventRecord.location);
  const locationLabel = extractTrailingLocationSegment(locationSource);
  const partners = resolvePartnerSlugs(eventRecord.partners);

  return {
    title,
    startDateTime: startDateTime || undefined,
    endDateTime: endDateTime || undefined,
    locationLabel,
    partners: partners.length > 0 ? partners : undefined,
    categoryChips: readLandingPageCategoryChips(eventRecord),
  };
}

export function getLandingPageBookingEventContent(
  slug: string,
  locale?: string,
): LandingPageBookingEventContent | null {
  const eventRecord = findLandingPageEventRecord(slug);
  if (!eventRecord) {
    return null;
  }

  const title = readCandidateText(eventRecord, ['title', 'name', 'eventTitle']);
  if (!title) {
    return null;
  }

  const normalizedLocale = resolveEventsLocale(locale);
  const summary = readCandidateText(eventRecord, [
    'summary',
    'description',
    'details',
    'excerpt',
    'body',
  ]);
  const locationName = readCandidateText(eventRecord, [
    'location_name',
    'locationName',
    'venue',
    'location_address',
    'locationAddress',
    'address',
  ]);
  const locationAddress = readCandidateText(eventRecord, [
    'location_address',
    'locationAddress',
    'venueAddress',
    'address',
  ]);
  const directionHref = sanitizeGoogleMapsHref(
    readCandidateText(eventRecord, [
      'location_url',
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
  const bookingSystem = readOptionalText(eventRecord.booking_system) ?? undefined;
  const resolvedPayload = resolveBookingModalPayload(
    eventRecord,
    bookingSystem,
    normalizedLocale,
    title,
    summary,
    locationName,
    locationAddress,
    directionHref,
  );

  return {
    status: resolveEventStatus(eventRecord),
    bookingPayload: resolvedPayload?.variant === 'event' ? resolvedPayload : null,
    ctaPriceLabel: formatLandingPageEventCtaPriceLabel(eventRecord),
  };
}

export function getLandingPageStructuredDataContent(
  slug: string,
): LandingPageStructuredDataContent | null {
  const eventRecord = findLandingPageEventRecord(slug);
  if (!eventRecord) {
    return null;
  }

  const title = readCandidateText(eventRecord, ['title', 'name', 'eventTitle']);
  if (!title) {
    return null;
  }

  const firstDateRecord = findFirstEventDateRecord(eventRecord);
  if (!firstDateRecord) {
    return null;
  }

  const startDateTime = readCandidateText(firstDateRecord, [
    'start_datetime',
    'startDateTime',
    'start',
  ]);
  if (!startDateTime) {
    return null;
  }

  const parsedStartDate = new Date(startDateTime);
  if (Number.isNaN(parsedStartDate.getTime())) {
    return null;
  }

  const endDateTime = readCandidateText(firstDateRecord, [
    'end_datetime',
    'endDateTime',
    'end',
  ]);
  const parsedEndDate = endDateTime ? new Date(endDateTime) : null;
  const endDate =
    parsedEndDate && !Number.isNaN(parsedEndDate.getTime())
      ? parsedEndDate.toISOString()
      : undefined;

  const description = readCandidateText(eventRecord, [
    'description',
    'summary',
    'details',
    'excerpt',
    'body',
  ]) ?? title;
  const locationAddress = readCandidateText(eventRecord, [
    'location_address',
    'locationAddress',
    'venueAddress',
    'address',
  ]);
  const locationName = readCandidateText(eventRecord, [
    'location_name',
    'locationName',
    'venue',
    'location_address',
    'locationAddress',
  ]) ?? extractTrailingLocationSegment(locationAddress);
  const offerPriceNumeric = resolveNumericCandidate(eventRecord, [
    'price',
    'cost',
    'amount',
    'fee',
    'eventPrice',
    'event_price',
  ]);
  const offerCurrency = readCandidateText(eventRecord, [
    'currency',
    'priceCurrency',
    'price_currency',
  ]);

  return {
    eventName: title,
    description,
    startDate: parsedStartDate.toISOString(),
    endDate,
    locationName: locationName ?? undefined,
    locationAddress: locationAddress ?? undefined,
    offerPrice: offerPriceNumeric === null ? undefined : String(offerPriceNumeric),
    offerCurrency: offerPriceNumeric === null ? undefined : (offerCurrency ?? 'HKD'),
    offerAvailability:
      resolveEventStatus(eventRecord) === 'fully_booked' ? 'SoldOut' : 'InStock',
  };
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
