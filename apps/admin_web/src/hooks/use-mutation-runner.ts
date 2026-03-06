'use client';

import { useCallback, useState } from 'react';

import { toErrorMessage } from './hook-errors';

export interface UseMutationRunnerReturn {
  isLoading: boolean;
  error: string;
  runWithState: <TResult>(work: () => Promise<TResult>) => Promise<TResult>;
}

export function useMutationRunner(fallbackMessage = 'Operation failed.'): UseMutationRunnerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const runWithState = useCallback(
    async <TResult>(work: () => Promise<TResult>): Promise<TResult> => {
      setIsLoading(true);
      setError('');
      try {
        const result = await work();
        return result;
      } catch (err) {
        setError(toErrorMessage(err, fallbackMessage));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fallbackMessage]
  );

  return { isLoading, error, runWithState };
}
