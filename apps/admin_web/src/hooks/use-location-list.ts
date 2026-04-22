'use client';

import { useCallback, useEffect, useState } from 'react';

import { listAllVenueAndPartnerLocations } from '@/lib/services-api';

import type { LocationSummary } from '@/types/services';

import { toErrorMessage } from './hook-errors';

export function useLocationList() {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const items = await listAllVenueAndPartnerLocations();
      setLocations(items);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load locations.'));
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    locations,
    isLoading,
    error,
    refetch,
  };
}
