'use client';

import { useMemo } from 'react';

import { PartnersPanel } from '@/components/admin/services/partners-panel';
import { useAdminEntityContacts } from '@/hooks/use-admin-entity-contacts';
import { useServicesPartnersContext } from '@/hooks/use-services-partners-context';
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
  const contacts = useAdminEntityContacts();

  const contactOptions = useMemo(() => {
    return contacts.contacts.map((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
      const label = name ? `${name}${c.email ? ` · ${c.email}` : ''}` : c.email || c.id;
      return { id: c.id, label };
    });
  }, [contacts.contacts]);

  const contactsForMembership = useMemo(
    () =>
      contacts.contacts.map((c) => ({
        id: c.id,
        contact_type: c.contact_type,
        family_ids: c.family_ids,
        organization_ids: c.organization_ids,
      })),
    [contacts.contacts]
  );

  const ctx = useServicesPartnersContext({
    partners,
    locations,
    geographicAreas,
    areasLoading,
    refreshLocations,
    contactOptions,
    contactsForMembership,
  });

  return (
    <PartnersPanel
      partners={ctx.partners}
      tags={ctx.tags}
      locations={ctx.locations}
      geographicAreas={ctx.geographicAreas}
      areasLoading={ctx.areasLoading}
      refreshLocations={ctx.refreshLocations}
      contactOptions={ctx.contactOptions}
      contactsForMembership={ctx.contactsForMembership}
      contactsListError={contacts.error}
      contactsLoading={contacts.isLoading}
      contactsLoadMore={contacts.loadMore}
      contactsHasMore={contacts.hasMore}
      contactsIsLoadingMore={contacts.isLoadingMore}
      tagsLoadError={ctx.tagsError}
    />
  );
}
