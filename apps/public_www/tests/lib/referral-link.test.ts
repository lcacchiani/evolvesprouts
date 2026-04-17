import { describe, expect, it } from 'vitest';

import { readReferralCodeFromSearch } from '@/lib/referral-link';

describe('readReferralCodeFromSearch', () => {
  it('prefers ref over discount when both are present', () => {
    expect(readReferralCodeFromSearch('?ref=ABC&discount=XYZ')).toBe('ABC');
    expect(readReferralCodeFromSearch('?DISCOUNT=XYZ&Ref=abc')).toBe('ABC');
  });

  it('falls back to discount when ref is absent', () => {
    expect(readReferralCodeFromSearch('?discount=spring10')).toBe('SPRING10');
  });

  it('is case-insensitive for param names', () => {
    expect(readReferralCodeFromSearch('?REF=aa')).toBe('AA');
  });

  it('returns null when absent', () => {
    expect(readReferralCodeFromSearch('')).toBeNull();
    expect(readReferralCodeFromSearch('?other=1')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(readReferralCodeFromSearch('?ref=%20%20SAVE%20%20')).toBe('SAVE');
  });

  it('rejects invalid characters', () => {
    expect(readReferralCodeFromSearch('?ref=SAVE@')).toBeNull();
  });
});
