'use client';

import { useCallback, useState } from 'react';

import { toErrorMessage } from '@/hooks/hook-errors';
import { AdminApiError } from '@/lib/api-admin-client';
import {
  createLocation,
  geocodeVenueAddress,
  updateLocation,
  updateLocationPartial,
} from '@/lib/services-api';
import type { LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export interface InlineLocationSaveStatus {
  isSaving: boolean;
  isGeocoding: boolean;
  error: string;
}

export function useInlineLocationSave(refreshLocations: () => Promise<void> | void) {
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
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
    async (
      id: string,
      payload: ApiSchemas['UpdateLocationRequest'] | ApiSchemas['PartialUpdateLocationRequest'],
      options?: { partial?: boolean }
    ): Promise<void> => {
      setError('');
      setIsSaving(true);
      try {
        if (options?.partial) {
          await updateLocationPartial(id, payload as ApiSchemas['PartialUpdateLocationRequest']);
        } else {
          await updateLocation(id, payload as ApiSchemas['UpdateLocationRequest']);
        }
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

  const geocode = useCallback(
    async (args: { area_id: string; address: string }): Promise<{ lat: number; lng: number }> => {
      setIsGeocoding(true);
      try {
        const result = await geocodeVenueAddress(args);
        return { lat: result.lat, lng: result.lng };
      } finally {
        setIsGeocoding(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const status: InlineLocationSaveStatus = {
    isSaving,
    isGeocoding,
    error,
  };

  return {
    status,
    createSharedLocation,
    updateSharedLocation,
    geocode,
    clearError,
    /** Classify geocode failures for inline copy (404 → environment message). */
    isGeocodeNotAvailableError(err: unknown): boolean {
      return err instanceof AdminApiError && err.statusCode === 404;
    },
  };
}
