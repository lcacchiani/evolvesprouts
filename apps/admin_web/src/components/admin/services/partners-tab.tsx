'use client';

import { useEffect } from 'react';

import { PartnersSection } from '@/components/admin/services/partners-section';
import { usePartners } from '@/hooks/use-partners';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';

export interface PartnersTabProps {
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
}

export function PartnersTab({
  locations,
  geographicAreas,
  areasLoading,
  refreshLocations,
}: PartnersTabProps) {
  const partners = usePartners();

  useEffect(() => {
    void partners.refetch();
  }, [partners]);

  return (
    <PartnersSection
      partners={partners}
      locations={locations}
      geographicAreas={geographicAreas}
      areasLoading={areasLoading}
      refreshLocations={refreshLocations}
    />
  );
}
