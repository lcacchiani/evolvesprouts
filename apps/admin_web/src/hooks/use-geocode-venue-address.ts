'use client';

import { useCallback, useState } from 'react';

import { geocodeVenueAddress } from '@/lib/services-api';

/**
 * Geocode-only helper for forms that do not need create/update location state
 * (for example VenuesPanel).
 */
export function useGeocodeVenueAddress() {
  const [isGeocoding, setIsGeocoding] = useState(false);

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

  return { geocode, isGeocoding };
}
