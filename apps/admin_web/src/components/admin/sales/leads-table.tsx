'use client';

import { useMemo, useState } from 'react';

import type { AdminUser, FunnelStage, LeadListFilters, LeadSummary } from '@/types/leads';

import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';

import { LeadsBulkActions } from './leads-bulk-actions';
import { LeadsFilterBar } from './leads-filter-bar';
import { LeadsTableRow } from './leads-table-row';

export interface LeadsTableProps {
  leads: LeadSummary[];
  filters: LeadListFilters;
  users: AdminUser[];
  selectedLeadId: string | null;
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onSelectLead: (leadId: string) => void;
  onFilterChange: <TKey extends keyof LeadListFilters>(
    key: TKey,
    value: LeadListFilters[TKey]
  ) => void;
  onBulkAssign: (leadIds: string[], assignedTo: string | null) => Promise<void> | void;
  onBulkStageChange: (
    leadIds: string[],
    stage: FunnelStage,
    lostReason?: string
  ) => Promise<void> | void;
}

export function LeadsTable({
  leads,
  filters,
  users,
  selectedLeadId,
  totalCount,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  onLoadMore,
  onSelectLead,
  onFilterChange,
  onBulkAssign,
  onBulkStageChange,
}: LeadsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleCheck = (leadId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...current, leadId] : current.filter((entry) => entry !== leadId)
    );
  };

  return (
    <PaginatedTableCard
      title={`Leads (${totalCount})`}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      loadingLabel='Loading leads...'
      onLoadMore={onLoadMore}
      toolbar={
        <div className='mb-3 space-y-3'>
          <LeadsFilterBar filters={filters} users={users} onFilterChange={onFilterChange} />
          <LeadsBulkActions
            selectedCount={selectedIds.length}
            users={users}
            onBulkAssign={(assignedTo) => {
              const normalizedAssignedTo = assignedTo === '__none__' ? null : assignedTo;
              void onBulkAssign(selectedIds, normalizedAssignedTo);
              setSelectedIds([]);
            }}
            onBulkStageChange={(stage, lostReason) => {
              void onBulkStageChange(selectedIds, stage, lostReason);
              setSelectedIds([]);
            }}
          />
        </div>
      }
    >
      <AdminDataTable tableClassName='min-w-[1080px]'>
        <AdminDataTableHead sticky>
          <tr>
            <th className='px-3 py-3'>
              <input
                type='checkbox'
                checked={leads.length > 0 && selectedIds.length === leads.length}
                onChange={(event) =>
                  setSelectedIds(event.target.checked ? leads.map((lead) => lead.id) : [])
                }
              />
            </th>
            <th className='px-3 py-3 font-semibold'>Name</th>
            <th className='px-3 py-3 font-semibold'>Email</th>
            <th className='px-3 py-3 font-semibold'>Source</th>
            <th className='px-3 py-3 font-semibold'>Stage</th>
            <th className='px-3 py-3 font-semibold'>Assigned</th>
            <th className='px-3 py-3 font-semibold'>Created</th>
            <th className='px-3 py-3 font-semibold'>Days in stage</th>
            <th className='px-3 py-3 text-right font-semibold'>Operations</th>
          </tr>
        </AdminDataTableHead>
        <AdminDataTableBody>
          {isLoading ? (
            <tr>
              <td colSpan={9} className='px-3 py-8 text-sm text-slate-600'>
                Loading leads...
              </td>
            </tr>
          ) : leads.length === 0 ? (
            <tr>
              <td colSpan={9} className='px-3 py-8 text-sm text-slate-600'>
                No leads found for these filters.
              </td>
            </tr>
          ) : (
            leads.map((lead) => (
              <LeadsTableRow
                key={lead.id}
                lead={lead}
                users={users}
                isSelected={selectedLeadId === lead.id}
                isChecked={selectedSet.has(lead.id)}
                onSelect={onSelectLead}
                onCheck={handleCheck}
              />
            ))
          )}
        </AdminDataTableBody>
      </AdminDataTable>
    </PaginatedTableCard>
  );
}
