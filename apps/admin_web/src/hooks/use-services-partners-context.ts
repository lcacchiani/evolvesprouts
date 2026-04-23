'use client';

import { useEffect, useMemo, useState } from 'react';

import { listEntityTags, type EntityTagRef } from '@/lib/entity-api';
import { toErrorMessage } from '@/hooks/hook-errors';
import type { usePartners } from '@/hooks/use-partners';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export function useServicesPartnersContext(params: {
  partners: ReturnType<typeof usePartners>;
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
  contactOptions: { id: string; label: string }[];
  contactsForMembership: {
    id: string;
    contact_type?: ApiSchemas['EntityContactType'];
    family_ids: string[];
    organization_ids: string[];
  }[];
}) {
  const {
    partners,
    locations,
    geographicAreas,
    areasLoading,
    refreshLocations,
    contactOptions,
    contactsForMembership,
  } = params;

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

  return useMemo(
    () => ({
      partners,
      tags,
      locations,
      geographicAreas,
      areasLoading,
      refreshLocations,
      contactOptions,
      contactsForMembership,
      tagsError,
    }),
    [
      partners,
      tags,
      locations,
      geographicAreas,
      areasLoading,
      refreshLocations,
      contactOptions,
      contactsForMembership,
      tagsError,
    ]
  );
}
