'use client';

import { useCallback, useState } from 'react';

import {
  createService,
  createServiceCoverImageUpload,
  deleteService,
  updateService,
} from '@/lib/services-api';

import type { components } from '@/types/generated/admin-api.generated';

import { toErrorMessage } from './hook-errors';

type ApiSchemas = components['schemas'];

export interface UseServiceMutationsOptions {
  onSuccess?: (serviceId?: string) => Promise<void> | void;
}

export function useServiceMutations(options: UseServiceMutationsOptions = {}) {
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
        setError(toErrorMessage(err, 'Failed to save service changes.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const createServiceEntry = useCallback(
    async (payload: ApiSchemas['CreateServiceRequest']) =>
      runWithState(async () => {
        const created = await createService(payload);
        await options.onSuccess?.(created?.id);
        return created;
      }),
    [options, runWithState]
  );

  const updateServiceEntry = useCallback(
    async (
      serviceId: string,
      payload: ApiSchemas['UpdateServiceRequest'] | ApiSchemas['PartialUpdateServiceRequest'],
      partial = false
    ) =>
      runWithState(async () => {
        const updated = await updateService(serviceId, payload, partial);
        await options.onSuccess?.(updated?.id ?? serviceId);
        return updated;
      }),
    [options, runWithState]
  );

  const deleteServiceEntry = useCallback(
    async (serviceId: string) =>
      runWithState(async () => {
        await deleteService(serviceId);
        await options.onSuccess?.();
      }),
    [options, runWithState]
  );

  const createCoverImageUpload = useCallback(
    async (serviceId: string, payload: ApiSchemas['CreateServiceCoverImageUploadRequest']) =>
      runWithState(async () => {
        const response = await createServiceCoverImageUpload(serviceId, payload);
        await options.onSuccess?.(serviceId);
        return response;
      }),
    [options, runWithState]
  );

  return {
    isLoading,
    error,
    createServiceEntry,
    updateServiceEntry,
    deleteServiceEntry,
    createCoverImageUpload,
  };
}
