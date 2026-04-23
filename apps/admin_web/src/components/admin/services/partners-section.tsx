'use client';

import { useEffect, useState } from 'react';

import { PartnersPanel } from '@/components/admin/services/partners-panel';
import { listEntityTags, type EntityTagRef } from '@/lib/entity-api';
import { toErrorMessage } from '@/hooks/hook-errors';
import type { usePartners } from '@/hooks/use-partners';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';

export interface PartnersSectionProps {
  partners: ReturnType<typeof usePartners>;
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
}

export function PartnersSection({
  partners,
  locations,
  geographicAreas,
  areasLoading,
  refreshLocations,
}: PartnersSectionProps) {
  const [tags, setTags] = useState<EntityTagRef[]>([]);
  const [tagsError, setTagsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tagList = await listEntityTags();
        if (!cancelled) {
          setTags(tagList);
          setTagsError('');
        }
      } catch (error) {
        if (!cancelled) {
          setTagsError(toErrorMessage(error, 'Failed to load tags.'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PartnersPanel
      partners={partners}
      tags={tags}
      locations={locations}
      geographicAreas={geographicAreas}
      areasLoading={areasLoading}
      refreshLocations={refreshLocations}
      tagsLoadError={tagsError}
    />
  );
}
