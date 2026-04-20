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

  const list = usePaginatedList({
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
        await list.refetch();
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [list]
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
      list.setItems((current) =>
        current.map((row) =>
          row.id === contactId ? { ...row, standalone_note_count: standaloneNoteCount } : row
        )
      );
    },
    [list]
  );

  return {
    contacts: list.items,
    filters: list.filters,
    setFilter: list.setFilter,
    isLoading: list.isLoading,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    error: list.error,
    loadMore: list.loadMore,
    totalCount: list.totalCount,
    isSaving,
    createContact,
    updateContact,
    deleteContact,
    patchContactStandaloneNoteCount,
    refetch: list.refetch,
  };
}
