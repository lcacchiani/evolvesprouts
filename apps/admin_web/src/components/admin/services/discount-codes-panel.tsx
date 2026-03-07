'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Textarea } from '@/components/ui/textarea';
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
      // Keep inline form state so users can retry.
    }
  };

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
        <div className='mb-3 space-y-3'>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-4'>
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
            <div className='sm:col-span-2 flex justify-end gap-2'>
              {editorMode === 'edit' ? (
                <Button type='button' variant='secondary' onClick={resetCreateForm}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type='button' onClick={resetCreateForm}>
                New code
              </Button>
            </div>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <Label htmlFor='discount-code'>Code</Label>
              <Input id='discount-code' value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
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
          <div className='flex justify-end gap-2'>
            {editorMode === 'edit' && selectedCode ? (
              <Button type='button' variant='danger' size='sm' disabled={isSaving} onClick={() => void onDelete(selectedCode.id)}>
                Delete
              </Button>
            ) : null}
            <Button
              type='button'
              size='sm'
              disabled={isSaving || !code.trim() || !discountValue.trim()}
              onClick={() => void handleSubmit()}
            >
              {editorMode === 'create' ? 'Create code' : 'Save code'}
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
            <th className='py-2 pr-3 font-medium'>Status</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr
              key={code.id}
              className={`cursor-pointer border-t ${
                selectedCodeId === code.id ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
              onClick={() => {
                setSelectedCodeId(code.id);
                setEditorMode('edit');
                setCode(code.code);
                setDescription(code.description ?? '');
                setDiscountType(code.discountType);
                setDiscountValue(code.discountValue);
                setCurrency(code.currency ?? 'HKD');
                setMaxUses(code.maxUses?.toString() ?? '');
                setActive(code.active);
              }}
            >
              <td className='py-2 pr-3'>{code.code}</td>
              <td className='py-2 pr-3'>{formatEnumLabel(code.discountType)}</td>
              <td className='py-2 pr-3'>
                {code.discountValue} {code.currency ?? ''}
              </td>
              <td className='py-2 pr-3'>{code.currentUses}/{code.maxUses ?? '∞'}</td>
              <td className='py-2 pr-3'>{code.active ? 'Enabled' : 'Disabled'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PaginatedTableCard>
  );
}
