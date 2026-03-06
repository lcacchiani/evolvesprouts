'use client';

import { useCallback } from 'react';

import { createEnrollment, deleteEnrollment, updateEnrollment } from '@/lib/services-api';

import type { components } from '@/types/generated/admin-api.generated';

import { useMutationRunner } from './use-mutation-runner';

type ApiSchemas = components['schemas'];

export interface UseEnrollmentMutationsOptions {
  onSuccess?: (enrollmentId?: string) => Promise<void> | void;
}

export function useEnrollmentMutations(options: UseEnrollmentMutationsOptions = {}) {
  const { isLoading, error, runWithState } = useMutationRunner(
    'Failed to save enrollment changes.'
  );

  const createEnrollmentEntry = useCallback(
    async (
      serviceId: string,
      instanceId: string,
      payload: ApiSchemas['CreateEnrollmentRequest']
    ) =>
      runWithState(async () => {
        const created = await createEnrollment(serviceId, instanceId, payload);
        await options.onSuccess?.(created?.id);
        return created;
      }),
    [options, runWithState]
  );

  const updateEnrollmentEntry = useCallback(
    async (
      serviceId: string,
      instanceId: string,
      enrollmentId: string,
      payload: ApiSchemas['UpdateEnrollmentRequest']
    ) =>
      runWithState(async () => {
        const updated = await updateEnrollment(serviceId, instanceId, enrollmentId, payload);
        await options.onSuccess?.(updated?.id ?? enrollmentId);
        return updated;
      }),
    [options, runWithState]
  );

  const deleteEnrollmentEntry = useCallback(
    async (serviceId: string, instanceId: string, enrollmentId: string) =>
      runWithState(async () => {
        await deleteEnrollment(serviceId, instanceId, enrollmentId);
        await options.onSuccess?.();
      }),
    [options, runWithState]
  );

  return {
    isLoading,
    error,
    createEnrollmentEntry,
    updateEnrollmentEntry,
    deleteEnrollmentEntry,
  };
}
