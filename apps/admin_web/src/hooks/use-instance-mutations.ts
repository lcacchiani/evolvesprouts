'use client';

import { useCallback } from 'react';

import { createInstance, deleteInstance, updateInstance } from '@/lib/services-api';

import type { components } from '@/types/generated/admin-api.generated';

import { useMutationRunner } from './use-mutation-runner';

type ApiSchemas = components['schemas'];

export interface UseInstanceMutationsOptions {
  onSuccess?: (instanceId?: string) => Promise<void> | void;
}

export function useInstanceMutations(options: UseInstanceMutationsOptions = {}) {
  const { isLoading, error, runWithState } = useMutationRunner(
    'Failed to save instance changes.'
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
