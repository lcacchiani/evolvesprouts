'use client';

import { useCallback, useState } from 'react';

export interface ListMutateOptions {
  /** When true, skip toggling `isSaving` (caller manages a longer-lived saving state). */
  suppressSaving?: boolean;
  /** When true, skip the post-mutation list refetch (caller will refetch once). */
  suppressRefetch?: boolean;
}

export interface UseListMutateOptions {
  /** Invoked after a successful mutation and after `refetch` when refetch was not suppressed. */
  onAfterSuccess?: () => void | Promise<void>;
}

export interface UseListMutateReturn {
  isSaving: boolean;
  mutate: <TResult>(work: () => Promise<TResult>, options?: ListMutateOptions) => Promise<TResult>;
}

/**
 * Wraps list mutations: optional saving flag, post-mutation refetch, optional success hook.
 * Used by admin entity and finance list hooks that share the same refetch-after-mutate pattern.
 */
export function useListMutate(
  refetch: () => Promise<void>,
  hookOptions: UseListMutateOptions = {}
): UseListMutateReturn {
  const { onAfterSuccess } = hookOptions;
  const [isSaving, setIsSaving] = useState(false);

  const mutate = useCallback(
    async <TResult>(work: () => Promise<TResult>, options: ListMutateOptions = {}): Promise<TResult> => {
      const { suppressSaving = false, suppressRefetch = false } = options;
      if (!suppressSaving) {
        setIsSaving(true);
      }
      try {
        const result = await work();
        if (!suppressRefetch) {
          await refetch();
        }
        await onAfterSuccess?.();
        return result;
      } finally {
        if (!suppressSaving) {
          setIsSaving(false);
        }
      }
    },
    [refetch, onAfterSuccess]
  );

  return { isSaving, mutate };
}
