import { describe, expect, it } from 'vitest';

import {
  isValidEmail,
  sanitizeSingleLineValue,
} from '@/lib/validation';

describe('validation helpers', () => {
  it('normalizes whitespace in single-line input values', () => {
    expect(sanitizeSingleLineValue('  hello   world  ')).toBe('hello world');
  });

  it('validates email addresses after trimming', () => {
    expect(isValidEmail(' user@example.com ')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });
});
