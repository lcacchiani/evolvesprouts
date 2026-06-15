'use client';

import { useMemo } from 'react';

import type { InlineLocationEmbeddedSummary } from '@/components/admin/locations/inline-location-editor';
import { useGeocodeVenueAddress } from '@/hooks/use-geocode-venue-address';
import { useInlineLocationSave } from '@/hooks/use-inline-location-save';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';

export interface EntityLocationSummarySource {
  id: string;
  name?: string | null;
  address?: string | null;
  area_name?: string | null;
  area_id?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface UseEntityInlineLocationOptions {
  editorMode: 'create' | 'edit';
  selectedId: string | null;
  stateKeyPrefix: string;
  pendingLocationId: string | null;
  setPendingLocationId: (locationId: string | null) => void;
  optimisticLocationSummary: InlineLocationEmbeddedSummary | null;
  setOptimisticLocationSummary: (summary: InlineLocationEmbeddedSummary | null) => void;
  selectedLocationSummary: EntityLocationSummarySource | null | undefined;
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  refreshLocations: () => Promise<void> | void;
}

export function useEntityInlineLocation({
  editorMode,
  selectedId,
  stateKeyPrefix,
  pendingLocationId,
  setPendingLocationId,
  optimisticLocationSummary,
  setOptimisticLocationSummary,
  selectedLocationSummary,
  locations,
  geographicAreas,
  refreshLocations,
}: UseEntityInlineLocationOptions) {
  const inlineLocationStateKey =
    editorMode === 'create' ? `${stateKeyPrefix}-new` : `${stateKeyPrefix}:${selectedId ?? 'none'}`;

  const resolvedLocation = useMemo(() => {
    if (!pendingLocationId) {
      return null;
    }
    return locations.find((location) => location.id === pendingLocationId) ?? null;
  }, [locations, pendingLocationId]);

  const embeddedLocationSummary = useMemo((): InlineLocationEmbeddedSummary | null => {
    if (resolvedLocation) {
      return null;
    }
    if (!pendingLocationId) {
      return null;
    }
    if (optimisticLocationSummary && optimisticLocationSummary.id === pendingLocationId) {
      return optimisticLocationSummary;
    }
    const summary = selectedLocationSummary;
    if (summary && summary.id === pendingLocationId) {
      return {
        id: summary.id,
        name: summary.name ?? null,
        address: summary.address ?? null,
        areaName: summary.area_name ?? 'Unknown area',
        areaId: summary.area_id,
        lat: summary.lat ?? null,
        lng: summary.lng ?? null,
      };
    }
    return null;
  }, [resolvedLocation, pendingLocationId, optimisticLocationSummary, selectedLocationSummary]);

  function summaryFromLocationRow(location: LocationSummary): InlineLocationEmbeddedSummary {
    const areaName = geographicAreas.find((area) => area.id === location.areaId)?.name ?? 'Unknown area';
    return {
      id: location.id,
      name: location.name,
      address: location.address,
      areaName,
      areaId: location.areaId,
      lat: location.lat,
      lng: location.lng,
    };
  }

  const {
    status: locationSaveStatus,
    createSharedLocation,
    updateSharedLocation,
    clearError: clearLocationSaveError,
  } = useInlineLocationSave(refreshLocations);
  const { geocode: geocodeLocation, isGeocoding: locationGeocoding } = useGeocodeVenueAddress();

  function clearPendingLocation() {
    setPendingLocationId(null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
  }

  async function saveNewLocation(
    payload: Parameters<typeof createSharedLocation>[0]
  ): Promise<string | null> {
    const created = await createSharedLocation(payload);
    if (created) {
      setPendingLocationId(created.id);
      setOptimisticLocationSummary(summaryFromLocationRow(created));
      return created.id;
    }
    return null;
  }

  return {
    inlineLocationStateKey,
    resolvedLocation,
    embeddedLocationSummary,
    locationSaveStatus,
    locationGeocoding,
    geocodeLocation,
    createSharedLocation,
    updateSharedLocation,
    clearLocationSaveError,
    clearPendingLocation,
    saveNewLocation,
    summaryFromLocationRow,
  };
}
