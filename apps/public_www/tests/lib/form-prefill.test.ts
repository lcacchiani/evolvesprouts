import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FORM_PREFILL_STORAGE_KEY,
  readFormPrefill,
  writeFormPrefill,
} from '@/lib/form-prefill';

describe('form-prefill', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('readFormPrefill returns defaults when storage is empty', () => {
    expect(readFormPrefill()).toEqual({ firstName: '', email: '' });
  });

  it('writeFormPrefill and readFormPrefill round-trip stored data', () => {
    writeFormPrefill({ firstName: 'Alice', email: 'alice@example.com' });
    expect(readFormPrefill()).toEqual({
      firstName: 'Alice',
      email: 'alice@example.com',
    });
    expect(sessionStorage.getItem(FORM_PREFILL_STORAGE_KEY)).toBe(
      JSON.stringify({ firstName: 'Alice', email: 'alice@example.com' }),
    );
  });

  it('partial write merges without erasing other fields', () => {
    writeFormPrefill({ firstName: 'Alice', email: 'alice@example.com' });
    writeFormPrefill({ email: 'bob@example.com' });
    expect(readFormPrefill()).toEqual({
      firstName: 'Alice',
      email: 'bob@example.com',
    });
  });

  it('partial write with only email preserves existing firstName', () => {
    writeFormPrefill({ firstName: 'Alice', email: 'alice@example.com' });
    writeFormPrefill({ email: 'charlie@example.com' });
    expect(readFormPrefill().firstName).toBe('Alice');
  });

  it('does not update fields when partial values are empty or whitespace', () => {
    writeFormPrefill({ firstName: 'Alice', email: 'alice@example.com' });
    writeFormPrefill({ firstName: '   ', email: '' });
    expect(readFormPrefill()).toEqual({
      firstName: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('readFormPrefill returns defaults for malformed JSON', () => {
    sessionStorage.setItem(FORM_PREFILL_STORAGE_KEY, 'not-json');
    expect(readFormPrefill()).toEqual({ firstName: '', email: '' });
  });

  it('readFormPrefill returns empty strings for non-string shape fields', () => {
    sessionStorage.setItem(FORM_PREFILL_STORAGE_KEY, JSON.stringify({ firstName: 1, email: null }));
    expect(readFormPrefill()).toEqual({ firstName: '', email: '' });
  });

  it('gracefully handles sessionStorage read throwing', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
    expect(readFormPrefill()).toEqual({ firstName: '', email: '' });
  });

  it('gracefully handles sessionStorage write throwing', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota');
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
    expect(() => writeFormPrefill({ firstName: 'A', email: 'a@b.co' })).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});
