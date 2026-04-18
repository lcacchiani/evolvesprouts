import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyTextToClipboard, tryCopyTextToClipboard } from '@/lib/clipboard';

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes via navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyTextToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('rejects when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});

    await expect(copyTextToClipboard('x')).rejects.toThrow(/Clipboard is not available/);
  });
});

describe('tryCopyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true on success', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    await expect(tryCopyTextToClipboard('ok')).resolves.toBe(true);
  });

  it('returns false when copyTextToClipboard would reject', async () => {
    vi.stubGlobal('navigator', {});

    await expect(tryCopyTextToClipboard('x')).resolves.toBe(false);
  });
});
