import { describe, expect, it } from 'vitest';

import { addHoursToDatetimeLocal } from '@/lib/session-slot-datetime';

describe('addHoursToDatetimeLocal', () => {
  it('adds hours in local wall time', () => {
    expect(addHoursToDatetimeLocal('2026-04-24T10:00', 2)).toBe('2026-04-24T12:00');
  });

  it('returns null for empty input', () => {
    expect(addHoursToDatetimeLocal('', 2)).toBeNull();
  });
});
