'use client';

import { useCallback, useState } from 'react';

import { createInstance, deleteInstance, updateInstance } from '@/lib/services-api';

import type { components } from '@/types/generated/admin-api.generated';

import { toErrorMessage } from './hook-errors';

type ApiSchemas = components['schemas'];

export interface UseInstanceMutationsOptions {
  onSuccess?: (instanceId?: string) => Promise<void> | void;
}

export function useInstanceMutations(options: UseInstanceMutationsOptions = {}) {
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
        setError(toErrorMessage(err, 'Failed to save instance changes.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const createInstanceEntry = useCallback(
    async (serviceId: string, payload: ApiSchemas['CreateInstanceRequest']) =>
      runWithState(async () => {
        const created = await createInstance(serviceId, payload);
        await options.onSuccess?.(created?.id);
        return created;
      }),
    [options, runWithState]
  );

  const updateInstanceEntry = useCallback(
    async (
      serviceId: string,
      instanceId: string,
      payload: ApiSchemas['UpdateInstanceRequest']
    ) =>
      runWithState(async () => {
        const updated = await updateInstance(serviceId, instanceId, payload);
        await options.onSuccess?.(updated?.id ?? instanceId);
        return updated;
      }),
    [options, runWithState]
  );

  const deleteInstanceEntry = useCallback(
    async (serviceId: string, instanceId: string) =>
      runWithState(async () => {
        await deleteInstance(serviceId, instanceId);
        await options.onSuccess?.();
      }),
    [options, runWithState]
  );

  return {
    isLoading,
    error,
    createInstanceEntry,
    updateInstanceEntry,
    deleteInstanceEntry,
  };
}
