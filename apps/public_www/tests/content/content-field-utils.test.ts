import { describe, expect, it } from 'vitest';

import {
  readCandidateTextFromUnknown,
  readRequiredRecordText,
  readRequiredText,
  readStringUnion,
  toRecord,
} from '@/content/content-field-utils';

describe('content-field-utils', () => {
  it('returns null when toRecord receives non-record values', () => {
    expect(toRecord(null)).toBeNull();
    expect(toRecord([])).toBeNull();
    expect(toRecord('text')).toBeNull();
  });

  it('reads candidate text directly from unknown payloads', () => {
    expect(
      readCandidateTextFromUnknown(
        { title: '  ', label: ' Hello ' },
        ['title', 'label'],
      ),
    ).toBe('Hello');
    expect(readCandidateTextFromUnknown('invalid', ['title'])).toBeUndefined();
  });

  it('normalizes string unions from unknown values', () => {
    const variants = ['left', 'center'] as const;

    expect(readStringUnion(' LEFT ', variants)).toBe('left');
    expect(readStringUnion('invalid', variants)).toBeUndefined();
    expect(readStringUnion(42, variants)).toBeUndefined();
  });

  it('normalizes required text from unknown values', () => {
    expect(readRequiredText('  Hello  ')).toBe('Hello');
    expect(readRequiredText('   ')).toBeNull();
    expect(readRequiredText(42)).toBeNull();
  });

  it('throws descriptive errors for missing or empty required record values', () => {
    expect(() => {
      readRequiredRecordText({}, 'title', 'hero');
    }).toThrow('Missing required "title" copy value for "hero".');

    expect(() => {
      readRequiredRecordText({ title: '   ' }, 'title', 'hero');
    }).toThrow('Empty "title" copy value for "hero".');
  });
});
