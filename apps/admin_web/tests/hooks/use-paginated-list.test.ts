import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePaginatedList } from '@/hooks/use-paginated-list';

type Filters = { query: string };

describe('usePaginatedList', () => {
  it('ignores stale responses when a newer refetch completes first', async () => {
    let resolveFirst: ((value: { items: string[]; nextCursor: null; totalCount: number }) => void) | null =
      null;
    let resolveSecond:
      | ((value: { items: string[]; nextCursor: null; totalCount: number }) => void)
      | null = null;

    const fetcher = vi.fn(
      ({ query }: Filters & { cursor: string | null; limit: number; signal: AbortSignal }) =>
        new Promise<{ items: string[]; nextCursor: null; totalCount: number }>((resolve, reject) => {
          if (query === 'first') {
            resolveFirst = resolve;
            return;
          }
          if (query === 'second') {
            resolveSecond = resolve;
            return;
          }
          reject(new Error(`Unexpected query: ${query}`));
        })
    );

    const { result } = renderHook(() =>
      usePaginatedList({
        fetcher,
        defaultFilters: { query: 'first' },
        fetchOnMount: false,
      })
    );

    await act(async () => {
      const firstPromise = result.current.refetch({ query: 'first' });
      const secondPromise = result.current.refetch({ query: 'second' });
      resolveSecond?.({ items: ['fresh'], nextCursor: null, totalCount: 1 });
      await secondPromise;
      resolveFirst?.({ items: ['stale'], nextCursor: null, totalCount: 1 });
      await firstPromise;
    });

    await waitFor(() => {
      expect(result.current.items).toEqual(['fresh']);
    });
  });

  it('does not set error state for aborted requests', async () => {
    const fetcher = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });

    const { result } = renderHook(() =>
      usePaginatedList({
        fetcher,
        defaultFilters: { query: '' },
        fetchOnMount: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('');
  });
});
