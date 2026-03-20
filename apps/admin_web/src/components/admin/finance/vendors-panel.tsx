'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';

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
    <PaginatedTableCard
      title='Vendors'
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      loadingLabel='Loading vendors...'
      onLoadMore={onLoadMore}
      toolbar={
        <div className='mb-3 space-y-3'>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-4'>
            <Input
              value={filters.query}
              onChange={(event) => onFilterChange('query', event.target.value)}
              placeholder='Search vendor name'
            />
            <Select
              value={filters.active}
              onChange={(event) => onFilterChange('active', event.target.value as VendorFilters['active'])}
            >
              <option value=''>All</option>
              <option value='true'>Active</option>
              <option value='false'>Inactive</option>
            </Select>
            <div className='sm:col-span-2 flex justify-end gap-2'>
              {editorMode === 'edit' ? (
                <Button type='button' variant='secondary' onClick={resetCreateForm}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type='button' onClick={resetCreateForm}>
                New vendor
              </Button>
            </div>
          </div>
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
          <div className='flex justify-end gap-2'>
            <Button type='button' size='sm' disabled={isSaving || !name.trim()} onClick={() => void handleSubmit()}>
              {editorMode === 'create' ? 'Create vendor' : 'Save vendor'}
            </Button>
          </div>
        </div>
      }
    >
      <table className='w-full min-w-[760px] text-left text-sm'>
        <thead className='text-slate-500'>
          <tr>
            <th className='py-2 pr-3 font-medium'>Name</th>
            <th className='py-2 pr-3 font-medium'>Website</th>
            <th className='py-2 pr-3 font-medium'>Status</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr
              key={vendor.id}
              className={`cursor-pointer border-t ${
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
              <td className='py-2 pr-3'>{vendor.name}</td>
              <td className='py-2 pr-3'>{vendor.website ?? '—'}</td>
              <td className='py-2 pr-3'>{vendor.active ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PaginatedTableCard>
  );
}
