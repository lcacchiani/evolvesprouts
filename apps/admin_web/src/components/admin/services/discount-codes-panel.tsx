'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatEnumLabel } from '@/lib/format';

import type { components } from '@/types/generated/admin-api.generated';
import { DISCOUNT_TYPES } from '@/types/services';
import type { DiscountCode, DiscountCodeFilters, DiscountType } from '@/types/services';

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
  onUpdate: (
    codeId: string,
    payload: ApiSchemas['UpdateDiscountCodeRequest']
  ) => Promise<unknown> | void;
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
  onUpdate,
  onDelete,
}: DiscountCodesPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<ApiSchemas['DiscountType']>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [currency, setCurrency] = useState('HKD');
  const [maxUses, setMaxUses] = useState('');
  const [active, setActive] = useState(true);

  const selectedCode = useMemo(
    () => codes.find((entry) => entry.id === selectedCodeId) ?? null,
    [codes, selectedCodeId]
  );

  const resetCreateForm = () => {
    setEditorMode('create');
    setSelectedCodeId(null);
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('');
    setCurrency('HKD');
    setMaxUses('');
    setActive(true);
  };

  const handleSubmit = async () => {
    const createPayload: ApiSchemas['CreateDiscountCodeRequest'] = {
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discount_type: discountType as DiscountType,
      discount_value: discountValue.trim(),
      currency: currency.trim() || null,
      max_uses: maxUses ? Number(maxUses) : null,
      active,
    };
    try {
      if (editorMode === 'create') {
        await onCreate(createPayload);
        resetCreateForm();
        return;
      }
      if (!selectedCode) {
        return;
      }
      await onUpdate(selectedCode.id, {
        description: description.trim() || null,
        discount_type: discountType as DiscountType,
        discount_value: discountValue.trim(),
        currency: currency.trim() || null,
        max_uses: maxUses ? Number(maxUses) : null,
        active,
      });
    } catch {
      // Keep inline form state visible to let users retry.
    }
  };

  const applyCodeSelection = (entry: DiscountCode) => {
    setSelectedCodeId(entry.id);
    setEditorMode('edit');
    setCode(entry.code);
    setDescription(entry.description ?? '');
    setDiscountType(entry.discountType);
    setDiscountValue(entry.discountValue);
    setCurrency(entry.currency ?? 'HKD');
    setMaxUses(entry.maxUses?.toString() ?? '');
    setActive(entry.active);
  };

  const handleDeleteCode = async (entry: DiscountCode) => {
    const confirmed = await requestConfirm({
      title: 'Delete discount code',
      description: `Delete "${entry.code}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDelete(entry.id);
    if (selectedCodeId === entry.id) {
      resetCreateForm();
    }
  };

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Discount code'
        description='Create a new code or select a row below to update. Codes cannot be changed after creation.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button
              type='button'
              disabled={isSaving || !code.trim() || !discountValue.trim()}
              onClick={() => void handleSubmit()}
            >
              {editorMode === 'create' ? 'Create code' : 'Update code'}
            </Button>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div>
            <Label htmlFor='discount-code'>Code</Label>
            <Input
              id='discount-code'
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              disabled={editorMode === 'edit'}
            />
          </div>
          <div>
            <Label htmlFor='discount-type'>Type</Label>
            <Select
              id='discount-type'
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as ApiSchemas['DiscountType'])}
            >
              {DISCOUNT_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-4'>
          <div>
            <Label htmlFor='discount-value'>Value</Label>
            <Input id='discount-value' value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='discount-currency'>Currency</Label>
            <Input id='discount-currency' value={currency} onChange={(event) => setCurrency(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='discount-max-uses'>Max uses</Label>
            <Input id='discount-max-uses' value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='discount-active'>Active</Label>
            <Select
              id='discount-active'
              value={active ? 'true' : 'false'}
              onChange={(event) => setActive(event.target.value === 'true')}
            >
              <option value='true'>Enabled</option>
              <option value='false'>Disabled</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor='discount-description'>Description</Label>
          <Textarea
            id='discount-description'
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Discount codes'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading discount codes...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[140px]'>
              <Label htmlFor='discount-filter-active'>Status</Label>
              <Select
                id='discount-filter-active'
                value={filters.active}
                onChange={(event) => onFilterChange('active', event.target.value as DiscountCodeFilters['active'])}
              >
                <option value=''>All</option>
                <option value='true'>Active</option>
                <option value='false'>Inactive</option>
              </Select>
            </div>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='discount-filter-search'>Search</Label>
              <Input
                id='discount-filter-search'
                value={filters.search}
                onChange={(event) => onFilterChange('search', event.target.value)}
                placeholder='Code'
              />
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[760px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Code</th>
              <th className='px-4 py-3 font-semibold'>Type</th>
              <th className='px-4 py-3 font-semibold'>Value</th>
              <th className='px-4 py-3 font-semibold'>Uses</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {codes.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer transition ${
                  selectedCodeId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => applyCodeSelection(row)}
              >
                <td className='px-4 py-3'>{row.code}</td>
                <td className='px-4 py-3'>{formatEnumLabel(row.discountType)}</td>
                <td className='px-4 py-3'>
                  {row.discountValue} {row.currency ?? ''}
                </td>
                <td className='px-4 py-3'>
                  {row.currentUses}/{row.maxUses ?? '∞'}
                </td>
                <td className='px-4 py-3'>{row.active ? 'Enabled' : 'Disabled'}</td>
                <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                  <Button
                    type='button'
                    size='sm'
                    variant='danger'
                    disabled={isSaving}
                    onClick={() => void handleDeleteCode(row)}
                    aria-label='Delete discount code'
                    title='Delete discount code'
                  >
                    <DeleteIcon className='h-4 w-4' />
                  </Button>
                </td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
