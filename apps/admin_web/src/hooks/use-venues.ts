'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createLocation,
  deleteLocation,
  listGeographicAreas,
  listLocations,
  updateLocation,
  updateLocationPartial,
} from '@/lib/services-api';
import { DEFAULT_VENUE_FILTERS } from '@/types/services';
import type { GeographicAreaSummary, LocationSummary, VenueFilters } from '@/types/services';

import type { components } from '@/types/generated/admin-api.generated';

import { toErrorMessage } from './hook-errors';
import { usePaginatedList } from './use-paginated-list';

type ApiSchemas = components['schemas'];

const DEBOUNCE_KEYS: (keyof VenueFilters)[] = ['search'];

export function useVenues(options: { onMutationSuccess?: () => void | Promise<void> } = {}) {
  const { onMutationSuccess } = options;

  const [geographicAreas, setGeographicAreas] = useState<GeographicAreaSummary[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setAreasLoading(true);
    setAreasError('');
    void (async () => {
      try {
        const items = await listGeographicAreas({ flat: true, activeOnly: true });
        if (!cancelled) {
          setGeographicAreas(items);
        }
      } catch (err) {
        if (!cancelled) {
          setGeographicAreas([]);
          setAreasError(toErrorMessage(err, 'Failed to load geographic areas.'));
        }
      } finally {
        if (!cancelled) {
          setAreasLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetcher = useCallback(
    (params: VenueFilters & { cursor: string | null; limit: number }) =>
      listLocations({
        cursor: params.cursor,
        limit: params.limit,
        areaId: params.areaId || undefined,
        search: params.search,
      }),
    []
  );

  const list = usePaginatedList<LocationSummary, VenueFilters>({
    fetcher,
    defaultFilters: DEFAULT_VENUE_FILTERS,
    errorPrefix: 'Failed to load venues',
    debounceKeys: DEBOUNCE_KEYS,
  });

  const { refetch } = list;
  const [isSaving, setIsSaving] = useState(false);

  const mutate = useCallback(
    async <TResult>(work: () => Promise<TResult>): Promise<TResult> => {
      setIsSaving(true);
      try {
        const result = await work();
        await refetch();
        await onMutationSuccess?.();
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch, onMutationSuccess]
  );

  const createVenue = useCallback(
    async (payload: ApiSchemas['CreateLocationRequest']) => mutate(async () => createLocation(payload)),
    [mutate]
  );

  const updateVenue = useCallback(
    async (venueId: string, payload: ApiSchemas['UpdateLocationRequest']) =>
      mutate(async () => updateLocation(venueId, payload)),
    [mutate]
  );

  const updateVenuePartial = useCallback(
    async (venueId: string, payload: ApiSchemas['PartialUpdateLocationRequest']) =>
      mutate(async () => updateLocationPartial(venueId, payload)),
    [mutate]
  );

  const deleteVenue = useCallback(
    async (venueId: string) =>
      mutate(async () => {
        await deleteLocation(venueId);
      }),
    [mutate]
  );

  return {
    venues: list.items,
    filters: list.filters,
    setFilter: list.setFilter,
    isLoading: list.isLoading,
    isLoadingMore: list.isLoadingMore,
    isSaving,
    error: list.error || areasError,
    refetch: list.refetch,
    loadMore: list.loadMore,
    hasMore: list.hasMore,
    totalCount: list.totalCount,
    createVenue,
    updateVenue,
    updateVenuePartial,
    deleteVenue,
    geographicAreas,
    areasLoading,
  };
}
