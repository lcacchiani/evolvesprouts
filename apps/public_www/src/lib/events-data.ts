import type { EventsContent } from '@/content';
import {
  readCandidateText,
  readOptionalText,
  toRecord,
} from '@/content/content-field-utils';
import { type CrmApiClient, buildCrmApiUrl } from '@/lib/crm-api-client';
import { isHttpHref } from '@/lib/url-utils';

export interface SortOption {
  value: EventFilterValue;
  label: string;
}

type EventStatus = 'open' | 'fully_booked';
type EventFilterValue = 'upcoming' | 'past';

export const EVENTS_API_PATH = '/v1/calendar/events';

export interface EventCardData {
  id: string;
  title: string;
  summary?: string;
  dateLabel?: string;
  timeLabel?: string;
  locationName?: string;
  locationAddress?: string;
  ctaHref: string;
  ctaLabel: string;
  tags: string[];
  status: EventStatus;
  timestamp: number | null;
}

const UTC_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DEFAULT_SORT_OPTIONS: readonly SortOption[] = [
  { value: 'upcoming', label: 'Upcoming Events' },
  { value: 'past', label: 'Past Events' },
];

function sanitizeExternalHref(value: string | undefined): string {
  const href = readOptionalText(value);
  if (!href || !isHttpHref(href)) {
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

function formatUtcDateLabel(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthName = UTC_MONTH_NAMES[date.getUTCMonth()] ?? '';
  const year = date.getUTCFullYear();

  return `${day} ${monthName} ${year}`;
}

function formatUtcTimeLabel(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const rawHours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const period = rawHours >= 12 ? 'PM' : 'AM';
  const hours = rawHours % 12 || 12;

  return `${hours}:${minutes} ${period}`;
}

function resolveDateTimeDetails(record: Record<string, unknown>): {
  dateLabel?: string;
  timeLabel?: string;
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

  const dateLabel = formatUtcDateLabel(startDateTime);
  const startTimeLabel = formatUtcTimeLabel(startDateTime);
  const endTimeLabel = endDateTime ? formatUtcTimeLabel(endDateTime) : '';
  const timeLabel =
    startTimeLabel && endTimeLabel
      ? `${startTimeLabel} - ${endTimeLabel}`
      : startTimeLabel;

  return {
    dateLabel: dateLabel || undefined,
    timeLabel: timeLabel || undefined,
    timestamp: parseTimestamp(startDateTime),
  };
}

function buildEventsApiUrl(crmApiBaseUrl: string): string {
  return buildCrmApiUrl(crmApiBaseUrl, EVENTS_API_PATH);
}

function normalizeLocationLabel(value: string | undefined): string | undefined {
  const normalizedValue = readOptionalText(value)?.toLowerCase();
  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue === 'virtual') {
    return 'Virtual';
  }

  if (normalizedValue === 'physical') {
    return 'In-person';
  }

  return normalizedValue;
}

function isEventFilterValue(value: string): value is EventFilterValue {
  return value === 'upcoming' || value === 'past';
}

export function resolveSortOptions(content: EventsContent): readonly SortOption[] {
  const normalizedOptions = content.sortOptions
    .map((option) => {
      const value = readOptionalText(option.value);
      const label = readOptionalText(option.label);
      if (!value || !label) {
        return null;
      }

      if (!isEventFilterValue(value)) {
        return null;
      }

      return { value, label };
    })
    .filter((option): option is SortOption => option !== null);

  const labelsByValue = new Map<EventFilterValue, string>();
  for (const option of normalizedOptions) {
    if (!labelsByValue.has(option.value)) {
      labelsByValue.set(option.value, option.label);
    }
  }

  return DEFAULT_SORT_OPTIONS.map((fallbackOption) => ({
    value: fallbackOption.value,
    label: labelsByValue.get(fallbackOption.value) ?? fallbackOption.label,
  }));
}

export async function fetchEventsPayload(
  crmApiClient: CrmApiClient,
  signal: AbortSignal,
): Promise<unknown> {
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
      if (!seenTags.has(tag)) {
        seenTags.add(tag);
        tags.push(tag);
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
): EventCardData | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const title = readCandidateText(record, ['title', 'name', 'eventTitle']);
  if (!title) {
    return null;
  }

  const dateTimeDetails = resolveDateTimeDetails(record);
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
  const timeLabel = readCandidateText(record, [
    'timeLabel',
    'time',
    'eventTime',
    'startTimeLabel',
    'timeDisplay',
  ]) ?? dateTimeDetails.timeLabel;

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

  return {
    id: rawId || fallbackId,
    title,
    summary,
    dateLabel,
    timeLabel,
    locationName,
    locationAddress:
      locationAddress && locationAddress !== locationName
        ? locationAddress
        : undefined,
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
): EventCardData[] {
  const eventsArray = findEventsArray(payload);

  return eventsArray
    .map((item, index) => normalizeEventCard(item, index, content))
    .filter((item): item is EventCardData => item !== null);
}

export function sortEvents(
  events: EventCardData[],
  activeFilter: string,
): EventCardData[] {
  const entries = events.map((event, index) => ({ event, index }));
  const now = Date.now();

  if (activeFilter === 'past') {
    const pastEntries = entries.filter((entry) => {
      const timestamp = entry.event.timestamp;
      return timestamp !== null && timestamp < now;
    });
    pastEntries.sort((left, right) => {
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

      return rightValue - leftValue;
    });
    return pastEntries.map((entry) => entry.event);
  }

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
