'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatEnumLabel, getCurrencyOptions } from '@/lib/format';

import { TRAINING_PRICING_UNITS } from '@/types/services';
import type { TrainingPricingUnit } from '@/types/services';

export interface TrainingFormState {
  pricingUnit: TrainingPricingUnit;
  defaultPrice: string;
  defaultCurrency: string;
}

export interface TrainingFormFieldsProps {
  value: TrainingFormState;
  onChange: (value: TrainingFormState) => void;
}

export function TrainingFormFields({ value, onChange }: TrainingFormFieldsProps) {
  const currencyOptions = getCurrencyOptions();

  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <div>
          <Label htmlFor='training-pricing-unit'>Pricing unit</Label>
          <Select
            id='training-pricing-unit'
            value={value.pricingUnit}
            onChange={(event) =>
              onChange({ ...value, pricingUnit: event.target.value as TrainingPricingUnit })
            }
          >
            {TRAINING_PRICING_UNITS.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor='training-default-price'>Default price</Label>
          <Input
            id='training-default-price'
            value={value.defaultPrice}
            onChange={(event) => onChange({ ...value, defaultPrice: event.target.value })}
            placeholder='0.00'
          />
        </div>
        <div>
          <Label htmlFor='training-default-currency'>Currency</Label>
          <Select
            id='training-default-currency'
            value={value.defaultCurrency}
            onChange={(event) => onChange({ ...value, defaultCurrency: event.target.value })}
          >
            {currencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
