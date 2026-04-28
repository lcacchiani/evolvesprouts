'use client';

import { useEffect, useMemo, useState } from 'react';

import { clampAdminListLimit } from '@/lib/admin-list-limit';
import {
  listAdminContacts,
  listEntityFamilyPicker,
  listEntityOrganizationPicker,
} from '@/lib/entity-api';
import { DEFAULT_CONTACT_LIST_FILTERS } from '@/types/entity-list';

import type { components } from '@/types/generated/admin-api.generated';

type AdminContact = components['schemas']['AdminContact'];

export interface EnrollmentParentPickerOption {
  id: string;
  label: string;
}

function formatContactSortKey(contact: AdminContact): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  return (name || contact.email || contact.id).toLowerCase();
}

function formatContactOptionLabel(contact: AdminContact): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  return name ? `${name}${contact.email ? ` · ${contact.email}` : ''}` : contact.email || contact.id;
}

export function useEnrollmentParentPickers(canCreate: boolean) {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [families, setFamilies] = useState<EnrollmentParentPickerOption[]>([]);
  const [organizations, setOrganizations] = useState<EnrollmentParentPickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canCreate) {
      setContacts([]);
      setFamilies([]);
      setOrganizations([]);
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

        const [familyItems, orgItems] = await Promise.all([
          listEntityFamilyPicker(signal),
          listEntityOrganizationPicker(undefined, signal),
        ]);

        const sortedFamilies = [...familyItems].sort((a, b) =>
          collator.compare(a.label.toLowerCase(), b.label.toLowerCase())
        );
        const sortedOrgs = [...orgItems].sort((a, b) =>
          collator.compare(a.label.toLowerCase(), b.label.toLowerCase())
        );

        setFamilies(sortedFamilies.map((row) => ({ id: row.id, label: row.label })));
        setOrganizations(sortedOrgs.map((row) => ({ id: row.id, label: row.label })));

        const contactRows: AdminContact[] = [];
        let cursor: string | null = null;
        do {
          const page = await listAdminContacts(
            {
              ...DEFAULT_CONTACT_LIST_FILTERS,
              cursor,
              limit: clampAdminListLimit(100),
            },
            signal
          );
          contactRows.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);

        contactRows.sort((a, b) => collator.compare(formatContactSortKey(a), formatContactSortKey(b)));
        setContacts(contactRows);
      } catch (err) {
        if (signal.aborted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load parent options.';
        setError(message);
        setContacts([]);
        setFamilies([]);
        setOrganizations([]);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [canCreate]);

  const contactOptions = useMemo<EnrollmentParentPickerOption[]>(
    () => contacts.map((c) => ({ id: c.id, label: formatContactOptionLabel(c) })),
    [contacts]
  );

  const labelByContactId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of contactOptions) {
      map.set(row.id, row.label);
    }
    return map;
  }, [contactOptions]);

  const labelByFamilyId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of families) {
      map.set(row.id, row.label);
    }
    return map;
  }, [families]);

  const labelByOrganizationId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of organizations) {
      map.set(row.id, row.label);
    }
    return map;
  }, [organizations]);

  return {
    contactOptions,
    families,
    organizations,
    loading,
    error,
    labelByContactId,
    labelByFamilyId,
    labelByOrganizationId,
  };
}
