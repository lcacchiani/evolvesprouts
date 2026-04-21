'use client';

import { useCallback, useState } from 'react';

import {
  createAdminContact,
  deleteAdminContact,
  listAdminContacts,
  updateAdminContact,
} from '@/lib/crm-api';
import { DEFAULT_CRM_LIST_FILTERS, type CrmListFilters } from '@/types/crm';
import type { components } from '@/types/generated/admin-api.generated';

import { usePaginatedList } from './use-paginated-list';

type ApiSchemas = components['schemas'];

export function useAdminCrmContacts() {
  const fetcher = useCallback(
    (params: CrmListFilters & { cursor: string | null; limit: number }) =>
      listAdminContacts({
        query: params.query,
        active: params.active || undefined,
        cursor: params.cursor,
        limit: params.limit,
      }),
    []
  );

  const {
    items: contacts,
    setItems: setContactRows,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    totalCount,
    refetch: refetchContacts,
  } = usePaginatedList({
    fetcher,
    defaultFilters: DEFAULT_CRM_LIST_FILTERS,
    errorPrefix: 'Failed to load contacts',
    debounceKeys: ['query'],
    limit: 50,
  });

  const [isSaving, setIsSaving] = useState(false);

  const mutate = useCallback(
    async <TResult,>(work: () => Promise<TResult>): Promise<TResult> => {
      setIsSaving(true);
      try {
        const result = await work();
        await refetchContacts();
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [refetchContacts]
  );

  const createContact = useCallback(
    async (payload: ApiSchemas['CreateAdminContactRequest']) =>
      mutate(async () => createAdminContact(payload)),
    [mutate]
  );

  const updateContact = useCallback(
    async (contactId: string, payload: ApiSchemas['UpdateAdminContactRequest']) =>
      mutate(async () => updateAdminContact(contactId, payload)),
    [mutate]
  );

  const deleteContact = useCallback(
    async (contactId: string) => mutate(async () => deleteAdminContact(contactId)),
    [mutate]
  );

  const patchContactStandaloneNoteCount = useCallback(
    (contactId: string, standaloneNoteCount: number) => {
      setContactRows((current) =>
        current.map((row) =>
          row.id === contactId ? { ...row, standalone_note_count: standaloneNoteCount } : row
        )
      );
    },
    [setContactRows]
  );

  return {
    contacts,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    totalCount,
    isSaving,
    createContact,
    updateContact,
    deleteContact,
    patchContactStandaloneNoteCount,
    refetch: refetchContacts,
  };
}
