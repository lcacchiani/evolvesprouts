'use client';

import { useCallback, useState } from 'react';

import { toErrorMessage } from '@/hooks/hook-errors';
import {
  createLocation,
  updateLocationPartial,
} from '@/lib/services-api';
import type { LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export interface InlineLocationSaveStatus {
  isSaving: boolean;
  error: string;
}

/**
 * Create and partially update shared locations for CRM inline editors.
 * Updates always use PATCH so omitted fields (for example `name`) are not wiped.
 */
export function useInlineLocationSave(refreshLocations: () => Promise<void> | void) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const createSharedLocation = useCallback(
    async (payload: ApiSchemas['CreateLocationRequest']): Promise<LocationSummary | null> => {
      setError('');
      setIsSaving(true);
      try {
        const loc = await createLocation(payload);
        await refreshLocations();
        return loc;
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to save location.'));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshLocations]
  );

  const updateSharedLocation = useCallback(
    async (id: string, payload: ApiSchemas['PartialUpdateLocationRequest']): Promise<void> => {
      setError('');
      setIsSaving(true);
      try {
        await updateLocationPartial(id, payload);
        await refreshLocations();
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to update location.'));
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshLocations]
  );

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const status: InlineLocationSaveStatus = {
    isSaving,
    error,
  };

  return {
    status,
    createSharedLocation,
    updateSharedLocation,
    clearError,
  };
}
