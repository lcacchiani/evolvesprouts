import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  compareInstancesByFirstSlotStartsDesc,
  formatAssetContentLanguageLabel,
  formatDate,
  formatDateOnly,
  formatEnumLabel,
  formatInstanceSlotLocationSummary,
  formatInstanceTableTitle,
  formatIsoForDatetimeLocalInput,
  formatServiceListPriceLabel,
  formatServiceTitleWithTier,
  formatSessionSlotStartsAtDisplay,
  getFirstSessionSlotStartTimeMs,
  getSessionSlotClosestToNow,
  getContentLanguageOptions,
  getCurrencyOptions,
  matchAdminSelectableContentLanguage,
  buildSessionSlotsUtcPayload,
  mapSessionSlotsFromApiToForm,
  orderSessionSlotsForDisplay,
  parseAdminDateTimeInputToIsoUtc,
  parseDatetimeLocalToIsoUtc,
  sessionSlotApiTimesToFormLocals,
} from '@/lib/format';
import type { ServiceInstance, ServiceSummary, SessionSlot } from '@/types/services';

function baseSummary(overrides: Partial<ServiceSummary> = {}): ServiceSummary {
  return {
    id: 's1',
    instancesCount: 0,
    serviceType: 'training_course',
    title: 'T',
    slug: null,
    bookingSystem: null,
    description: null,
    coverImageS3Key: null,
    deliveryMode: 'online',
    status: 'draft',
    serviceTier: null,
    locationId: null,
    createdBy: 'u',
    createdAt: null,
    updatedAt: null,
    trainingDetails: null,
    eventDetails: null,
    consultationDetails: null,
    ...overrides,
  };
}

describe('format helpers', () => {
  it('formats snake_case values into title case labels', () => {
    expect(formatEnumLabel('training_course')).toBe('Training Course');
    expect(formatEnumLabel('in_person')).toBe('In Person');
  });

  it('formats session slot starts for instances table', () => {
    expect(formatSessionSlotStartsAtDisplay(null)).toBe('-');
    expect(formatSessionSlotStartsAtDisplay('')).toBe('-');
    expect(formatSessionSlotStartsAtDisplay('not-a-date')).toBe('-');
    const line = formatSessionSlotStartsAtDisplay('2026-06-15T14:30:00Z');
    expect(line).toMatch(/^\d{2} \w+ @ \d{2}:\d{2}$/);
  });

  it('orders session slots by sort_order then starts_at', () => {
    const slots: SessionSlot[] = [
      { id: 'a', instanceId: null, locationId: null, startsAt: '2026-01-10T10:00:00Z', endsAt: null, sortOrder: 2 },
      { id: 'b', instanceId: null, locationId: null, startsAt: '2026-01-05T10:00:00Z', endsAt: null, sortOrder: 1 },
    ];
    const ordered = orderSessionSlotsForDisplay(slots);
    expect(ordered.map((s) => s.id)).toEqual(['b', 'a']);
  });

  describe('getSessionSlotClosestToNow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null when no valid slot times', () => {
      expect(getSessionSlotClosestToNow([])).toBeNull();
      expect(
        getSessionSlotClosestToNow([
          { id: 'x', instanceId: null, locationId: null, startsAt: null, endsAt: null, sortOrder: 0 },
        ])
      ).toBeNull();
    });

    it('picks the slot with smallest absolute distance to now', () => {
      const slots: SessionSlot[] = [
        { id: 'far-past', instanceId: null, locationId: null, startsAt: '2026-01-01T10:00:00Z', endsAt: null, sortOrder: 0 },
        { id: 'soon', instanceId: null, locationId: null, startsAt: '2026-06-01T18:00:00Z', endsAt: null, sortOrder: 1 },
        { id: 'far-future', instanceId: null, locationId: null, startsAt: '2026-12-01T10:00:00Z', endsAt: null, sortOrder: 2 },
      ];
      expect(getSessionSlotClosestToNow(slots)?.id).toBe('soon');
    });

    it('breaks distance ties using orderSessionSlotsForDisplay order', () => {
      const slots: SessionSlot[] = [
        {
          id: 'first',
          instanceId: null,
          locationId: null,
          startsAt: '2026-06-01T00:00:00Z',
          endsAt: null,
          sortOrder: 0,
        },
        {
          id: 'second',
          instanceId: null,
          locationId: null,
          startsAt: '2026-06-02T00:00:00Z',
          endsAt: null,
          sortOrder: 1,
        },
      ];
      expect(getSessionSlotClosestToNow(slots)?.id).toBe('first');
    });
  });

  it('formats service title with tier using spaced interpunct when tier is set', () => {
    expect(formatServiceTitleWithTier('Yoga', 'adults')).toBe('Yoga · adults');
    expect(formatServiceTitleWithTier('Yoga', null)).toBe('Yoga');
    expect(formatServiceTitleWithTier('Yoga', '  ')).toBe('Yoga');
  });

  it('formats instance table title from own title or parent service title', () => {
    const base = (): ServiceInstance => ({
      id: 'i1',
      serviceId: 's1',
      parentServiceTitle: 'Parent',
      parentServiceTier: 'tier-a',
      parentServiceType: 'training_course',
      title: null,
      slug: null,
      description: null,
      coverImageS3Key: null,
      status: 'scheduled',
      deliveryMode: null,
      locationId: null,
      maxCapacity: null,
      waitlistEnabled: false,
      externalUrl: null,
      partnerOrganizations: [],
      instructorId: null,
      cohort: null,
      notes: null,
      tagIds: [],
      createdBy: 'u',
      createdAt: null,
      updatedAt: null,
      resolvedTitle: 'Resolved',
      resolvedSlug: null,
      resolvedDescription: null,
      resolvedCoverImageS3Key: null,
      resolvedDeliveryMode: null,
      resolvedLocationId: null,
      sessionSlots: [],
      trainingDetails: null,
      resolvedTrainingDetails: null,
      eventTicketTiers: [],
      resolvedEventTicketTiers: [],
      consultationDetails: null,
      resolvedConsultationDetails: null,
    });
    expect(formatInstanceTableTitle({ ...base(), title: '  My run  ' })).toBe('My run');
    expect(formatInstanceTableTitle(base())).toBe('Parent · tier-a');
    expect(
      formatInstanceTableTitle({
        ...base(),
        title: null,
        parentServiceTitle: null,
      })
    ).toBe('');
    expect(formatInstanceTableTitle({ ...base(), title: 'My run', cohort: 'spring-2024' })).toBe('My run');
    expect(formatInstanceTableTitle({ ...base(), cohort: 'spring-2024' })).toBe('Parent · tier-a');
    expect(
      formatInstanceTableTitle({
        ...base(),
        title: null,
        parentServiceTitle: null,
        parentServiceTier: null,
        cohort: 'spring-2024',
      })
    ).toBe('');
  });

  it('summarizes instance locations including partner org venues', () => {
    const locById = new Map([
      [
        'loc-a',
        {
          id: 'loc-a',
          name: 'Hall A',
          areaId: 'area-1',
          address: null,
          lat: null,
          lng: null,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: false,
          partnerOrganizationLabels: [],
          partnerOrganizationIds: [],
        },
      ],
      [
        'loc-b',
        {
          id: 'loc-b',
          name: 'Partner venue',
          areaId: 'area-1',
          address: null,
          lat: null,
          lng: null,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: true,
          partnerOrganizationLabels: ['Co'],
          partnerOrganizationIds: ['org-1'],
        },
      ],
    ]);
    const instance: ServiceInstance = {
      id: 'i1',
      serviceId: 's1',
      parentServiceTitle: null,
      parentServiceTier: null,
      parentServiceType: null,
      title: null,
      slug: null,
      description: null,
      coverImageS3Key: null,
      status: 'scheduled',
      deliveryMode: null,
      locationId: 'loc-a',
      maxCapacity: null,
      waitlistEnabled: false,
      externalUrl: null,
      partnerOrganizations: [
        { id: 'org-1', name: 'Co', active: true, locationId: 'loc-b' },
      ],
      instructorId: null,
      cohort: null,
      notes: null,
      tagIds: [],
      createdBy: 'u',
      createdAt: null,
      updatedAt: null,
      resolvedTitle: null,
      resolvedSlug: null,
      resolvedDescription: null,
      resolvedCoverImageS3Key: null,
      resolvedDeliveryMode: null,
      resolvedLocationId: null,
      sessionSlots: [
        {
          id: 'slot-1',
          instanceId: 'i1',
          locationId: 'loc-a',
          startsAt: '2026-01-01T10:00:00Z',
          endsAt: null,
          sortOrder: 0,
        },
      ],
      trainingDetails: null,
      resolvedTrainingDetails: null,
      eventTicketTiers: [],
      resolvedEventTicketTiers: [],
      consultationDetails: null,
      resolvedConsultationDetails: null,
    };
    expect(formatInstanceSlotLocationSummary(instance, locById)).toBe('Hall A · Co');
  });

  it('uses earliest ordered slot time for instance sort key', () => {
    const slots: SessionSlot[] = [
      { id: 'late', instanceId: null, locationId: null, startsAt: '2026-02-01T10:00:00Z', endsAt: null, sortOrder: 2 },
      { id: 'early', instanceId: null, locationId: null, startsAt: '2026-01-01T10:00:00Z', endsAt: null, sortOrder: 1 },
    ];
    expect(getFirstSessionSlotStartTimeMs(slots)).toBe(new Date('2026-01-01T10:00:00Z').getTime());
  });

  it('sorts instances by first slot start descending', () => {
    const mk = (id: string, startsAt: string | null): ServiceInstance => ({
      id,
      serviceId: 'svc',
      parentServiceTitle: null,
      parentServiceTier: null,
      parentServiceType: null,
      title: null,
      slug: null,
      description: null,
      coverImageS3Key: null,
      status: 'scheduled',
      deliveryMode: null,
      locationId: null,
      maxCapacity: null,
      waitlistEnabled: false,
      externalUrl: null,
      partnerOrganizations: [],
      instructorId: null,
      cohort: null,
      notes: null,
      tagIds: [],
      createdBy: 'u',
      createdAt: null,
      updatedAt: null,
      resolvedTitle: null,
      resolvedSlug: null,
      resolvedDescription: null,
      resolvedCoverImageS3Key: null,
      resolvedDeliveryMode: null,
      resolvedLocationId: null,
      sessionSlots: startsAt
        ? [
            {
              id: 's',
              instanceId: id,
              locationId: null,
              startsAt,
              endsAt: null,
              sortOrder: 0,
            },
          ]
        : [],
      trainingDetails: null,
      resolvedTrainingDetails: null,
      eventTicketTiers: [],
      resolvedEventTicketTiers: [],
      consultationDetails: null,
      resolvedConsultationDetails: null,
    });
    const later = mk('b', '2026-06-01T12:00:00Z');
    const earlier = mk('a', '2026-05-01T12:00:00Z');
    const noSlots = mk('c', null);
    const sorted = [earlier, noSlots, later].sort(compareInstancesByFirstSlotStartsDesc);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('formats service list price labels by service type', () => {
    expect(
      formatServiceListPriceLabel(
        baseSummary({
          serviceType: 'training_course',
          trainingDetails: {
            pricingUnit: 'per_person',
            defaultPrice: '100',
            defaultCurrency: 'HKD',
          },
        })
      )
    ).toBe('HK$100.00');

    expect(
      formatServiceListPriceLabel(
        baseSummary({
          serviceType: 'event',
          trainingDetails: null,
          eventDetails: {
            eventCategory: 'workshop',
            defaultPrice: '50',
            defaultCurrency: 'USD',
          },
        })
      )
    ).toBe('US$50.00');

    expect(
      formatServiceListPriceLabel(
        baseSummary({
          serviceType: 'consultation',
          trainingDetails: null,
          consultationDetails: {
            consultationFormat: 'one_on_one',
            maxGroupSize: null,
            durationMinutes: 60,
            pricingModel: 'free',
            defaultHourlyRate: null,
            defaultPackagePrice: null,
            defaultPackageSessions: null,
            defaultCurrency: 'HKD',
          },
        })
      )
    ).toBe('Free');

    expect(
      formatServiceListPriceLabel(
        baseSummary({
          serviceType: 'consultation',
          trainingDetails: null,
          consultationDetails: {
            consultationFormat: 'one_on_one',
            maxGroupSize: null,
            durationMinutes: null,
            pricingModel: 'hourly',
            defaultHourlyRate: '200',
            defaultPackagePrice: null,
            defaultPackageSessions: null,
            defaultCurrency: 'HKD',
          },
        })
      )
    ).toBe('HK$200.00 / hr');

    expect(
      formatServiceListPriceLabel(
        baseSummary({
          serviceType: 'consultation',
          trainingDetails: null,
          consultationDetails: {
            consultationFormat: 'group',
            maxGroupSize: 4,
            durationMinutes: null,
            pricingModel: 'package',
            defaultHourlyRate: null,
            defaultPackagePrice: '1200',
            defaultPackageSessions: 6,
            defaultCurrency: 'HKD',
          },
        })
      )
    ).toBe('HK$1,200.00 (6 sessions)');
  });

  it('exposes HKD, USD, EUR, GBP, CNY, and SGD in currency options with expected labels', () => {
    const options = getCurrencyOptions();
    expect(options.map((o) => o.value)).toEqual(['HKD', 'USD', 'EUR', 'GBP', 'CNY', 'SGD']);
    expect(options.some((option) => option.value === 'HKD' && option.label === 'HKD Hong Kong Dollar')).toBe(true);
  });

  it('exposes en, zh-CN, and zh-HK in content language options with fixed labels', () => {
    const options = getContentLanguageOptions();
    expect(options.map((o) => o.value)).toEqual(['en', 'zh-CN', 'zh-HK']);
    expect(options.find((o) => o.value === 'en')?.label).toBe('English');
    expect(options.find((o) => o.value === 'zh-CN')?.label).toBe('Mandarin (Simplified)');
    expect(options.find((o) => o.value === 'zh-HK')?.label).toBe('Cantonese (Hong Kong)');
  });

  it('formats known content_language tags and shows raw values for unknown tags', () => {
    expect(formatAssetContentLanguageLabel('en')).toBe('English');
    expect(formatAssetContentLanguageLabel(null)).toBe('—');
    expect(formatAssetContentLanguageLabel('fr')).toBe('fr');
  });

  it('classifies stored content_language against the admin allowlist', () => {
    expect(matchAdminSelectableContentLanguage('zh-HK')).toBe('zh-HK');
    expect(matchAdminSelectableContentLanguage('  ')).toBe(null);
    expect(matchAdminSelectableContentLanguage('fr')).toBe('unrecognized');
  });

  it('formats dates in the local timezone and default locale', () => {
    const iso = '2026-03-01T10:00:00Z';
    const parsed = new Date(iso);
    const expected = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
    expect(formatDate(iso)).toBe(expected);
    expect(formatDate(null)).toBe('—');
  });

  it('formats date-only values in the local timezone and default locale', () => {
    const iso = '2026-03-01T10:00:00Z';
    const parsed = new Date(iso);
    const expected = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
    expect(formatDateOnly(iso)).toBe(expected);
    expect(formatDateOnly(null)).toBe('—');
  });

  it('maps API ISO instants to datetime-local strings and back for the API', () => {
    expect(formatIsoForDatetimeLocalInput(null)).toBe('');
    const iso = '2026-06-01T08:30:00.000Z';
    const local = formatIsoForDatetimeLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const back = parseDatetimeLocalToIsoUtc(local);
    expect(back).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns null for empty datetime-local input', () => {
    expect(parseDatetimeLocalToIsoUtc('')).toBeNull();
    expect(parseDatetimeLocalToIsoUtc('   ')).toBeNull();
  });

  it('parseDatetimeLocalToIsoUtc accepts only YYYY-MM-DDTHH:mm (rejects Z, offset, seconds)', () => {
    expect(parseDatetimeLocalToIsoUtc('2026-06-10T09:15:00.000Z')).toBeNull();
    expect(parseDatetimeLocalToIsoUtc('2026-06-10T09:15:00+08:00')).toBeNull();
    expect(parseDatetimeLocalToIsoUtc('2026-06-10T09:15:30')).toBeNull();
  });

  it('parseAdminDateTimeInputToIsoUtc accepts wall format and RFC3339 with Z', () => {
    const wall = '2026-06-10T09:15';
    expect(parseAdminDateTimeInputToIsoUtc(wall)).toBe(parseDatetimeLocalToIsoUtc(wall));
    expect(parseAdminDateTimeInputToIsoUtc('2026-06-10T09:15:00.000Z')).toMatch(/Z$/);
  });

  it('sessionSlotApiTimesToFormLocals keeps wall-clock strings and maps UTC ISO to local input', () => {
    expect(sessionSlotApiTimesToFormLocals('2026-06-15T14:30', '2026-06-15T16:30')).toEqual({
      startsAtLocal: '2026-06-15T14:30',
      endsAtLocal: '2026-06-15T16:30',
    });
    const iso = '2026-06-01T08:30:00.000Z';
    const expectedLocal = formatIsoForDatetimeLocalInput(iso);
    expect(sessionSlotApiTimesToFormLocals(iso, null).startsAtLocal).toBe(expectedLocal);
  });

  it('mapSessionSlotsFromApiToForm converts API instants to datetime-local wall strings', () => {
    const iso = '2026-06-01T08:30:00.000Z';
    const slots: SessionSlot[] = [
      {
        id: 'a',
        instanceId: 'b',
        locationId: null,
        startsAt: iso,
        endsAt: iso,
        sortOrder: 0,
      },
    ];
    const local = formatIsoForDatetimeLocalInput(iso);
    const mapped = mapSessionSlotsFromApiToForm(slots)[0];
    expect(mapped.startsAtLocal).toBe(local);
    expect(mapped.endsAtLocal).toBe(local);
  });

  it('buildSessionSlotsUtcPayload sends UTC ISO for wall-format rows and rejects offset ISO in form state', () => {
    const startsLocal = '2026-06-10T09:15';
    const endsLocal = '2026-06-10T11:15';
    const ok = buildSessionSlotsUtcPayload([
      {
        id: null,
        instanceId: null,
        locationId: null,
        startsAtLocal: startsLocal,
        endsAtLocal: endsLocal,
        sortOrder: 0,
      },
    ]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.session_slots[0].starts_at).toBe(parseDatetimeLocalToIsoUtc(startsLocal));
      expect(ok.session_slots[0].ends_at).toBe(parseDatetimeLocalToIsoUtc(endsLocal));
    }
    const bad = buildSessionSlotsUtcPayload([
      {
        id: null,
        instanceId: null,
        locationId: null,
        startsAtLocal: '2026-06-10T06:30:00.000Z',
        endsAtLocal: '2026-06-10T08:30:00.000Z',
        sortOrder: 0,
      },
    ]);
    expect(bad.ok).toBe(false);
  });

  it('buildSessionSlotsUtcPayload allows empty slot rows and rejects partial times', () => {
    const empty = buildSessionSlotsUtcPayload([
      {
        id: null,
        instanceId: null,
        locationId: null,
        startsAtLocal: null,
        endsAtLocal: null,
        sortOrder: 0,
      },
    ]);
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.session_slots[0].starts_at).toBeNull();
      expect(empty.session_slots[0].ends_at).toBeNull();
    }
    const partial = buildSessionSlotsUtcPayload([
      {
        id: null,
        instanceId: null,
        locationId: null,
        startsAtLocal: '2026-06-10T09:15',
        endsAtLocal: null,
        sortOrder: 0,
      },
    ]);
    expect(partial.ok).toBe(false);
  });
});
