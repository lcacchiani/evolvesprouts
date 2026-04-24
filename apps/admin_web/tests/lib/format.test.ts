import { describe, expect, it } from 'vitest';

import {
  formatAssetContentLanguageLabel,
  formatDate,
  formatDateOnly,
  formatEnumLabel,
  formatIsoForDatetimeLocalInput,
  formatServiceListPriceLabel,
  getContentLanguageOptions,
  getCurrencyOptions,
  matchAdminSelectableContentLanguage,
  parseDatetimeLocalToIsoUtc,
} from '@/lib/format';
import type { ServiceSummary } from '@/types/services';

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
});
