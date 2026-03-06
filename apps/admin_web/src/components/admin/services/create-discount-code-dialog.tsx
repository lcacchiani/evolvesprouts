'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { DISCOUNT_TYPES } from '@/types/services';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export interface CreateDiscountCodeDialogProps {
  open: boolean;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: ApiSchemas['CreateDiscountCodeRequest']) => Promise<void> | void;
}

export function CreateDiscountCodeDialog({
  open,
  isLoading,
  error,
  onClose,
  onCreate,
}: CreateDiscountCodeDialogProps) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<ApiSchemas['DiscountType']>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [currency, setCurrency] = useState('HKD');
  const [maxUses, setMaxUses] = useState('');
  const [active, setActive] = useState(true);

  if (!open) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className='w-full max-w-xl'>
        <Card title='Create discount code' className='space-y-3'>
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
                    {entry}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <div>
              <Label htmlFor='discount-value'>Value</Label>
              <Input id='discount-value' value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
            </div>
            <div>
              <Label htmlFor='discount-currency'>Currency</Label>
              <Input
                id='discount-currency'
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label htmlFor='discount-max-uses'>Max uses</Label>
              <Input id='discount-max-uses' value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
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
          <div>
            <Label htmlFor='discount-active'>Active</Label>
            <Select
              id='discount-active'
              value={active ? 'true' : 'false'}
              onChange={(event) => setActive(event.target.value === 'true')}
            >
              <option value='true'>true</option>
              <option value='false'>false</option>
            </Select>
          </div>
          {error ? <p className='text-sm text-red-600'>{error}</p> : null}
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isLoading || !code.trim() || !discountValue.trim()}
              onClick={async () =>
                onCreate({
                  code: code.trim(),
                  description: description.trim() || null,
                  discount_type: discountType,
                  discount_value: discountValue.trim(),
                  currency: currency.trim() || null,
                  max_uses: maxUses ? Number(maxUses) : null,
                  active,
                })
              }
            >
              {isLoading ? 'Creating...' : 'Create code'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
