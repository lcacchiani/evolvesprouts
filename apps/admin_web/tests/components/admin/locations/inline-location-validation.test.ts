import { describe, expect, it } from 'vitest';

import { computeLatLngErrors, parseOptionalCoordinate } from '@/components/admin/locations/inline-location-validation';

describe('parseOptionalCoordinate', () => {
  it('returns null for empty or whitespace', () => {
    expect(parseOptionalCoordinate('')).toBeNull();
    expect(parseOptionalCoordinate('   ')).toBeNull();
  });

  it('returns finite numbers for valid numeric strings', () => {
    expect(parseOptionalCoordinate('22.3')).toBe(22.3);
    expect(parseOptionalCoordinate('-114')).toBe(-114);
  });

  it('returns NaN for non-numeric input', () => {
    const r = parseOptionalCoordinate('abc');
    expect(Number.isNaN(r)).toBe(true);
  });
});

describe('computeLatLngErrors', () => {
  it('detects parse errors', () => {
    const e = computeLatLngErrors('x', '1');
    expect(e.latParseError).toBe(true);
    expect(e.coordinatesInvalid).toBe(true);
  });

  it('detects range errors', () => {
    const e = computeLatLngErrors('100', '0');
    expect(e.latRangeError).toBe(true);
    expect(e.coordinatesInvalid).toBe(true);
  });

  it('detects only one coordinate provided', () => {
    const e = computeLatLngErrors('1', '');
    expect(e.onlyOneCoordinate).toBe(true);
  });

  it('allows both empty', () => {
    const e = computeLatLngErrors('', '');
    expect(e.onlyOneCoordinate).toBe(false);
    expect(e.coordinatesInvalid).toBe(false);
  });
});
