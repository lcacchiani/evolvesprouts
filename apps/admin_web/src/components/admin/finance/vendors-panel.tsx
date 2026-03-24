'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { PencilIcon } from '@/components/icons/action-icons';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatHkdAmount } from '@/lib/vendor-spend-hkd';

import type { components } from '@/types/generated/admin-api.generated';
import type { Vendor, VendorFilters } from '@/types/vendors';

type ApiSchemas = components['schemas'];

interface VendorsPanelProps {
  vendors: Vendor[];
  filters: VendorFilters;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSaving: boolean;
  hasMore: boolean;
  error: string;
  onFilterChange: <TKey extends keyof VendorFilters>(key: TKey, value: VendorFilters[TKey]) => void;
  onLoadMore: () => Promise<void> | void;
  onCreate: (payload: ApiSchemas['CreateVendorRequest']) => Promise<unknown> | void;
  onUpdate: (vendorId: string, payload: ApiSchemas['UpdateVendorRequest']) => Promise<unknown> | void;
  vendorSpendHkdByVendorId: Map<string, number>;
  isVendorSpendLoading: boolean;
  vendorSpendError?: string;
}

export function VendorsPanel({
  vendors,
  filters,
  isLoading,
  isLoadingMore,
  isSaving,
  hasMore,
  error,
  onFilterChange,
  onLoadMore,
  onCreate,
  onUpdate,
  vendorSpendHkdByVendorId,
  isVendorSpendLoading,
  vendorSpendError,
}: VendorsPanelProps) {
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [active, setActive] = useState(true);

  const selectedVendor = useMemo(
    () => vendors.find((entry) => entry.id === selectedVendorId) ?? null,
    [vendors, selectedVendorId]
  );

  function resetCreateForm() {
    setEditorMode('create');
    setSelectedVendorId(null);
    setName('');
    setWebsite('');
    setActive(true);
  }

  async function handleSubmit() {
    try {
      if (editorMode === 'create') {
        await onCreate({
          name: name.trim(),
          website: website.trim() || null,
          active,
        });
        resetCreateForm();
        return;
      }
      if (!selectedVendor) {
        return;
      }
      await onUpdate(selectedVendor.id, {
        name: name.trim(),
        website: website.trim() || null,
        active,
      });
    } catch {
      // Keep inline form state so users can retry.
    }
  }

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Vendor'
        description='Create a new vendor or select one in the table below to update.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button type='button' disabled={isSaving || !name.trim()} onClick={() => void handleSubmit()}>
              {editorMode === 'create' ? 'Create vendor' : 'Update vendor'}
            </Button>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <div>
            <Label htmlFor='vendor-name'>Name</Label>
            <Input id='vendor-name' value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='vendor-website'>Website</Label>
            <Input id='vendor-website' value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='vendor-active'>Status</Label>
            <Select
              id='vendor-active'
              value={active ? 'true' : 'false'}
              onChange={(event) => setActive(event.target.value === 'true')}
            >
              <option value='true'>Active</option>
              <option value='false'>Inactive</option>
            </Select>
          </div>
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Vendors'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading vendors...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 space-y-2'>
            {vendorSpendError ? (
              <p className='text-sm text-amber-700' role='status'>
                {vendorSpendError}
              </p>
            ) : null}
            <div className='flex flex-wrap items-end gap-3'>
              <div className='min-w-[200px] flex-1'>
                <Label htmlFor='vendors-search'>Search</Label>
                <Input
                  id='vendors-search'
                  value={filters.query}
                  onChange={(event) => onFilterChange('query', event.target.value)}
                  placeholder='Vendor name'
                />
              </div>
              <div className='min-w-[140px]'>
                <Label htmlFor='vendors-active'>Status</Label>
                <Select
                  id='vendors-active'
                  value={filters.active}
                  onChange={(event) => onFilterChange('active', event.target.value as VendorFilters['active'])}
                >
                  <option value=''>All</option>
                  <option value='true'>Active</option>
                  <option value='false'>Inactive</option>
                </Select>
              </div>
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[760px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold text-right'>Total spend (HKD)</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold text-right'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {vendors.map((vendor) => (
              <tr
                key={vendor.id}
                className={`cursor-pointer transition ${
                  selectedVendorId === vendor.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => {
                  setSelectedVendorId(vendor.id);
                  setEditorMode('edit');
                  setName(vendor.name);
                  setWebsite(vendor.website ?? '');
                  setActive(vendor.active);
                }}
              >
                <td className='px-4 py-3'>{vendor.name}</td>
                <td className='px-4 py-3 text-right tabular-nums'>
                  {isVendorSpendLoading ? (
                    '…'
                  ) : (
                    formatHkdAmount(vendorSpendHkdByVendorId.get(vendor.id) ?? 0)
                  )}
                </td>
                <td className='px-4 py-3'>{vendor.active ? 'Active' : 'Inactive'}</td>
                <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onClick={() => {
                      setSelectedVendorId(vendor.id);
                      setEditorMode('edit');
                      setName(vendor.name);
                      setWebsite(vendor.website ?? '');
                      setActive(vendor.active);
                    }}
                    aria-label='Edit vendor'
                    title='Edit vendor'
                  >
                    <PencilIcon className='h-4 w-4' />
                  </Button>
                </td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
    </div>
  );
}
