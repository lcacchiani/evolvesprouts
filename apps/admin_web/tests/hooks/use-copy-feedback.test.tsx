import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCopyFeedback } from '@/hooks/use-copy-feedback';

describe('useCopyFeedback', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears copied key after duration', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyFeedback(1000));

    act(() => {
      result.current.markCopied('row-1');
    });
    expect(result.current.copiedKey).toBe('row-1');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.copiedKey).toBeNull();
  });
});
