'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ContactsPanel } from '@/components/admin/contacts/contacts-panel';
import { FamiliesPanel } from '@/components/admin/contacts/families-panel';
import { OrganizationsPanel } from '@/components/admin/contacts/organizations-panel';
import { StatusBanner } from '@/components/status-banner';
import { AdminTabStrip } from '@/components/ui/admin-tab-strip';
import { listCrmTags, type CrmTagRef } from '@/lib/crm-api';
import { listAllLocations, listGeographicAreas } from '@/lib/services-api';
import { toErrorMessage } from '@/hooks/hook-errors';
import { useAdminCrmContacts } from '@/hooks/use-admin-crm-contacts';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { useAdminCrmFamilies } from '@/hooks/use-admin-crm-families';
import { useAdminCrmOrganizations } from '@/hooks/use-admin-crm-organizations';
import { useQueryTabState } from '@/hooks/use-query-tab-state';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';

const TAB_ITEMS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'families', label: 'Families' },
  { key: 'organizations', label: 'Organisations' },
] as const;

type ContactsView = (typeof TAB_ITEMS)[number]['key'];

const CONTACTS_TAB_KEYS: readonly ContactsView[] = TAB_ITEMS.map(
  (item) => item.key
);
const DEFAULT_CONTACTS_VIEW: ContactsView = 'contacts';

export function ContactsPage() {
  const [activeView, setActiveView] = useQueryTabState<ContactsView>(
    CONTACTS_TAB_KEYS,
    DEFAULT_CONTACTS_VIEW
  );
  const [tags, setTags] = useState<CrmTagRef[]>([]);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [geographicAreas, setGeographicAreas] = useState<GeographicAreaSummary[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [pickerError, setPickerError] = useState('');

  const contacts = useAdminCrmContacts();
  const adminUsers = useAdminUsers();
  const families = useAdminCrmFamilies();
  const organizations = useAdminCrmOrganizations();

  const patchStandaloneNoteCountRef = useRef(contacts.patchContactStandaloneNoteCount);
  useLayoutEffect(() => {
    patchStandaloneNoteCountRef.current = contacts.patchContactStandaloneNoteCount;
  });
  const stablePatchStandaloneNoteCount = useCallback((contactId: string, count: number) => {
    patchStandaloneNoteCountRef.current(contactId, count);
  }, []);

  const refreshLocations = useCallback(async () => {
    const locList = await listAllLocations();
    setLocations(locList);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPickerLoading(true);
      try {
        const [tagList, locList, areaList] = await Promise.all([
          listCrmTags(),
          listAllLocations(),
          listGeographicAreas({ flat: true, activeOnly: true }),
        ]);
        if (!cancelled) {
          setTags(tagList);
          setLocations(locList);
          setGeographicAreas(areaList);
          setPickerError('');
        }
      } catch (error) {
        if (!cancelled) {
          setPickerError(toErrorMessage(error, 'Failed to load tags or locations.'));
        }
      } finally {
        if (!cancelled) {
          setPickerLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        family_ids: c.family_ids,
        organization_ids: c.organization_ids,
      })),
    [contacts.contacts]
  );

  const hasAnyError =
    pickerError ||
    contacts.error ||
    families.error ||
    organizations.error;

  return (
    <div className='space-y-4'>
      {hasAnyError ? (
        <StatusBanner variant='error' title='Contacts'>
          {hasAnyError}
        </StatusBanner>
      ) : null}

      <AdminTabStrip
        items={TAB_ITEMS}
        activeKey={activeView}
        onChange={setActiveView}
        aria-label='Contacts section views'
      />

      {activeView === 'contacts' ? (
        <ContactsPanel
          contacts={contacts}
          adminUsers={adminUsers.users}
          onPatchStandaloneNoteCount={stablePatchStandaloneNoteCount}
          tags={tags}
          locations={locations}
          geographicAreas={geographicAreas}
          areasLoading={pickerLoading}
          refreshLocations={refreshLocations}
        />
      ) : activeView === 'families' ? (
        <FamiliesPanel
          families={families}
          tags={tags}
          locations={locations}
          geographicAreas={geographicAreas}
          areasLoading={pickerLoading}
          refreshLocations={refreshLocations}
          contactOptions={contactOptions}
          contactsForMembership={contactsForMembership}
        />
      ) : (
        <OrganizationsPanel
          organizations={organizations}
          tags={tags}
          locations={locations}
          geographicAreas={geographicAreas}
          areasLoading={pickerLoading}
          refreshLocations={refreshLocations}
          contactOptions={contactOptions}
          contactsForMembership={contactsForMembership}
        />
      )}
    </div>
  );
}
