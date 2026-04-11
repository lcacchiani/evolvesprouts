'use client';

import { useCallback, useState } from 'react';

import {
  addAdminFamilyMember,
  createAdminFamily,
  listAdminFamilies,
  removeAdminFamilyMember,
  updateAdminFamily,
} from '@/lib/crm-api';
import { DEFAULT_CRM_LIST_FILTERS, type CrmListFilters } from '@/types/crm';
import type { components } from '@/types/generated/admin-api.generated';

import { usePaginatedList } from './use-paginated-list';

type ApiSchemas = components['schemas'];

export function useAdminCrmFamilies() {
  const fetcher = useCallback(
    (params: CrmListFilters & { cursor: string | null; limit: number }) =>
      listAdminFamilies({
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
    errorPrefix: 'Failed to load families',
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

  const createFamily = useCallback(
    async (payload: ApiSchemas['CreateAdminFamilyRequest']) =>
      mutate(async () => createAdminFamily(payload)),
    [mutate]
  );

  const updateFamily = useCallback(
    async (familyId: string, payload: ApiSchemas['UpdateAdminFamilyRequest']) =>
      mutate(async () => updateAdminFamily(familyId, payload)),
    [mutate]
  );

  const addMember = useCallback(
    async (familyId: string, payload: ApiSchemas['AddFamilyMemberRequest']) =>
      mutate(async () => addAdminFamilyMember(familyId, payload)),
    [mutate]
  );

  const removeMember = useCallback(
    async (familyId: string, memberId: string) =>
      mutate(async () => removeAdminFamilyMember(familyId, memberId)),
    [mutate]
  );

  return {
    families: list.items,
    filters: list.filters,
    setFilter: list.setFilter,
    isLoading: list.isLoading,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    error: list.error,
    loadMore: list.loadMore,
    totalCount: list.totalCount,
    isSaving,
    createFamily,
    updateFamily,
    addMember,
    removeMember,
    refetch: list.refetch,
  };
}
