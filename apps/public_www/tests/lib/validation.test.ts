import { describe, expect, it } from 'vitest';

import {
  deriveFirstNameFromEmailLocalPart,
  isValidEmail,
  resolveEmailSignupFirstName,
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

  it('derives a first-name token from the email local-part', () => {
    expect(deriveFirstNameFromEmailLocalPart('pat.smith@example.com')).toBe('pat');
    expect(deriveFirstNameFromEmailLocalPart('user+tag@example.com')).toBe('user');
    expect(deriveFirstNameFromEmailLocalPart('  jane_doe@example.com ')).toBe('jane');
  });

  it('resolves email signup first name with capitalised first letter or fallback', () => {
    expect(
      resolveEmailSignupFirstName('pat.smith@example.com', 'Friend'),
    ).toBe('Pat');
    expect(resolveEmailSignupFirstName('user+tag@example.com', 'Friend')).toBe('User');
    expect(resolveEmailSignupFirstName('  jane_doe@example.com ', 'Friend')).toBe('Jane');
    expect(resolveEmailSignupFirstName('not-an-email', 'Friend')).toBe('Friend');
    expect(resolveEmailSignupFirstName('@example.com', 'Friend')).toBe('Friend');
  });
});
