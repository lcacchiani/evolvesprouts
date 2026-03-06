'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';

import { CreateDiscountCodeDialog } from './create-discount-code-dialog';

import type { components } from '@/types/generated/admin-api.generated';
import type { DiscountCode, DiscountCodeFilters } from '@/types/services';

type ApiSchemas = components['schemas'];

export interface DiscountCodesPanelProps {
  codes: DiscountCode[];
  filters: DiscountCodeFilters;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSaving: boolean;
  hasMore: boolean;
  error: string;
  onFilterChange: <TKey extends keyof DiscountCodeFilters>(
    key: TKey,
    value: DiscountCodeFilters[TKey]
  ) => void;
  onLoadMore: () => Promise<void> | void;
  onCreate: (payload: ApiSchemas['CreateDiscountCodeRequest']) => Promise<unknown> | void;
  onDelete: (codeId: string) => Promise<void> | void;
}

export function DiscountCodesPanel({
  codes,
  filters,
  isLoading,
  isLoadingMore,
  isSaving,
  hasMore,
  error,
  onFilterChange,
  onLoadMore,
  onCreate,
  onDelete,
}: DiscountCodesPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <PaginatedTableCard
      title='Discount codes'
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      loadingLabel='Loading discount codes...'
      onLoadMore={onLoadMore}
      toolbar={
        <div className='mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4'>
          <Select
            value={filters.active}
            onChange={(event) => onFilterChange('active', event.target.value as DiscountCodeFilters['active'])}
          >
            <option value=''>All</option>
            <option value='true'>Active</option>
            <option value='false'>Inactive</option>
          </Select>
          <Input
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder='Search code'
          />
          <div className='sm:col-span-2 flex justify-end'>
            <Button type='button' onClick={() => setIsCreateOpen(true)}>
              New code
            </Button>
          </div>
        </div>
      }
    >
      <table className='w-full min-w-[760px] text-left text-sm'>
        <thead className='text-slate-500'>
          <tr>
            <th className='py-2 pr-3 font-medium'>Code</th>
            <th className='py-2 pr-3 font-medium'>Type</th>
            <th className='py-2 pr-3 font-medium'>Value</th>
            <th className='py-2 pr-3 font-medium'>Uses</th>
            <th className='py-2 pr-3 font-medium'>Actions</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code.id} className='border-t'>
              <td className='py-2 pr-3'>{code.code}</td>
              <td className='py-2 pr-3'>{code.discountType}</td>
              <td className='py-2 pr-3'>
                {code.discountValue} {code.currency ?? ''}
              </td>
              <td className='py-2 pr-3'>
                {code.currentUses}/{code.maxUses ?? '∞'}
              </td>
              <td className='py-2 pr-3'>
                <Button type='button' variant='danger' size='sm' onClick={() => void onDelete(code.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <CreateDiscountCodeDialog
        key={isCreateOpen ? 'discount-dialog-open' : 'discount-dialog-closed'}
        open={isCreateOpen}
        isLoading={isSaving}
        error={error}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (payload) => {
          await onCreate(payload);
          setIsCreateOpen(false);
        }}
      />
    </PaginatedTableCard>
  );
}
