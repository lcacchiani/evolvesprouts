'use client';

import { useCallback, useState } from 'react';

import {
  addAdminOrganizationMember,
  createAdminOrganization,
  deleteAdminOrganization,
  listAdminOrganizations,
  removeAdminOrganizationMember,
  updateAdminOrganization,
} from '@/lib/crm-api';
import { DEFAULT_CRM_LIST_FILTERS, type CrmListFilters } from '@/types/crm';
import { CRM_ORGANIZATION_RELATIONSHIP_TYPES } from '@/types/crm-relationship';
import type { components } from '@/types/generated/admin-api.generated';

import { usePaginatedList } from './use-paginated-list';

type ApiSchemas = components['schemas'];

export function useAdminCrmOrganizations() {
  const fetcher = useCallback(
    (params: CrmListFilters & { cursor: string | null; limit: number }) =>
      listAdminOrganizations({
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
    errorPrefix: 'Failed to load organizations',
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

  const createOrganization = useCallback(
    async (payload: ApiSchemas['CreateAdminOrganizationRequest']) =>
      mutate(async () => createAdminOrganization(payload)),
    [mutate]
  );

  const updateOrganization = useCallback(
    async (organizationId: string, payload: ApiSchemas['UpdateAdminOrganizationRequest']) =>
      mutate(async () => updateAdminOrganization(organizationId, payload)),
    [mutate]
  );

  const addMember = useCallback(
    async (organizationId: string, payload: ApiSchemas['AddOrganizationMemberRequest']) =>
      mutate(async () => addAdminOrganizationMember(organizationId, payload)),
    [mutate]
  );

  const removeMember = useCallback(
    async (organizationId: string, memberId: string) =>
      mutate(async () => removeAdminOrganizationMember(organizationId, memberId)),
    [mutate]
  );

  const deleteOrganization = useCallback(
    async (organizationId: string) =>
      mutate(async () => deleteAdminOrganization(organizationId)),
    [mutate]
  );

  return {
    organizations: list.items,
    filters: list.filters,
    setFilter: list.setFilter,
    isLoading: list.isLoading,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    error: list.error,
    loadMore: list.loadMore,
    totalCount: list.totalCount,
    isSaving,
    createOrganization,
    updateOrganization,
    addMember,
    removeMember,
    deleteOrganization,
    refetch: list.refetch,
    crmRelationshipOptions: CRM_ORGANIZATION_RELATIONSHIP_TYPES,
  };
}
