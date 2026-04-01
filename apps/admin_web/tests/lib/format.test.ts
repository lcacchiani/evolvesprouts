import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateOnly,
  formatEnumLabel,
  formatIsoForDatetimeLocalInput,
  getCurrencyOptions,
  parseDatetimeLocalToIsoUtc,
} from '@/lib/format';

describe('format helpers', () => {
  it('formats snake_case values into title case labels', () => {
    expect(formatEnumLabel('training_course')).toBe('Training Course');
    expect(formatEnumLabel('in_person')).toBe('In Person');
  });

  it('exposes only HKD, USD, EUR, CNY, and SGD in currency options with expected labels', () => {
    const options = getCurrencyOptions();
    expect(options.map((o) => o.value)).toEqual(['HKD', 'USD', 'EUR', 'CNY', 'SGD']);
    expect(options.some((option) => option.value === 'HKD' && option.label === 'HKD Hong Kong Dollar')).toBe(true);
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
