import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useListMutate } from '@/hooks/use-list-mutate';

describe('useListMutate', () => {
  it('refetches after successful work and clears isSaving', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const work = vi.fn().mockResolvedValue('ok');

    const { result } = renderHook(() => useListMutate(refetch));

    await act(async () => {
      await result.current.mutate(work);
    });

    expect(work).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
  });

  it('skips refetch when suppressRefetch is true', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useListMutate(refetch));

    await act(async () => {
      await result.current.mutate(async () => 1, { suppressRefetch: true });
    });

    expect(refetch).not.toHaveBeenCalled();
  });

  it('skips saving flag when suppressSaving is true', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useListMutate(refetch));

    await act(async () => {
      await result.current.mutate(async () => 1, { suppressSaving: true });
    });

    expect(result.current.isSaving).toBe(false);
    expect(refetch).toHaveBeenCalled();
  });

  it('runs onAfterSuccess after refetch', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const onAfterSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useListMutate(refetch, { onAfterSuccess }));

    await act(async () => {
      await result.current.mutate(async () => undefined);
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onAfterSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not refetch or run onAfterSuccess when work rejects, clears isSaving, and propagates rejection', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const onAfterSuccess = vi.fn().mockResolvedValue(undefined);
    const boom = new Error('mutate failed');
    const work = vi.fn().mockRejectedValue(boom);

    const { result } = renderHook(() => useListMutate(refetch, { onAfterSuccess }));

    await act(async () => {
      await expect(result.current.mutate(work)).rejects.toThrow('mutate failed');
    });

    expect(refetch).not.toHaveBeenCalled();
    expect(onAfterSuccess).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it('keeps isSaving false on rejection when suppressSaving is true', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const work = vi.fn().mockRejectedValue(new Error('no'));

    const { result } = renderHook(() => useListMutate(refetch));

    await act(async () => {
      await expect(result.current.mutate(work, { suppressSaving: true })).rejects.toThrow('no');
    });

    expect(result.current.isSaving).toBe(false);
    expect(refetch).not.toHaveBeenCalled();
  });
});
