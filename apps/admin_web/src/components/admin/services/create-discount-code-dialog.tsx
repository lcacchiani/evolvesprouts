'use client';

import { useState } from 'react';

import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel, getCurrencyOptions } from '@/lib/format';

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
  const currencyOptions = getCurrencyOptions();

  return (
    <FormDialog
      open={open}
      title='Create Discount Code'
      isLoading={isLoading}
      error={error}
      submitLabel='Create code'
      submitDisabled={!code.trim() || !discountValue.trim()}
      maxWidth='max-w-xl'
      onClose={onClose}
      onSubmit={async () => {
        await onCreate({
          code: code.trim(),
          description: description.trim() || null,
          discount_type: discountType,
          discount_value: discountValue.trim(),
          currency: currency.trim() || null,
          max_uses: maxUses ? Number(maxUses) : null,
          active,
        });
      }}
    >
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
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <div>
          <Label htmlFor='discount-value'>Value</Label>
          <Input id='discount-value' value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
        </div>
        <div>
          <Label htmlFor='discount-currency'>Currency</Label>
          <Select
            id='discount-currency'
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {currencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
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
          <option value='true'>Enabled</option>
          <option value='false'>Disabled</option>
        </Select>
      </div>
    </FormDialog>
  );
}
