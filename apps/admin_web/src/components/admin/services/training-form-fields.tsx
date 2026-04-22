'use client';

import type { ReactNode } from 'react';

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
  disabled?: boolean;
  onChange: (value: TrainingFormState) => void;
  /**
   * When set with `layout="service-detail"` or `layout="instance-detail"`, renders a
   * single md+ row of four equal columns: leading column plus pricing unit, price, currency.
   */
  leadingColumn?: ReactNode;
  layout?: 'default' | 'service-detail' | 'instance-detail';
}

export function TrainingFormFields({
  value,
  disabled = false,
  onChange,
  leadingColumn,
  layout = 'default',
}: TrainingFormFieldsProps) {
  const currencyOptions = getCurrencyOptions();

  const pricingGridClass =
    layout === 'service-detail' || layout === 'instance-detail'
      ? 'grid grid-cols-1 gap-3 md:grid-cols-4'
      : 'grid grid-cols-1 gap-3 sm:grid-cols-3';

  return (
    <div className='space-y-3'>
      <div className={pricingGridClass}>
        {(layout === 'service-detail' || layout === 'instance-detail') && leadingColumn ? (
          <div>{leadingColumn}</div>
        ) : null}
        <div>
          <Label htmlFor='training-pricing-unit'>Pricing unit</Label>
          <Select
            id='training-pricing-unit'
            value={value.pricingUnit}
            disabled={disabled}
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
            disabled={disabled}
            onChange={(event) => onChange({ ...value, defaultPrice: event.target.value })}
            placeholder='0.00'
          />
        </div>
        <div>
          <Label htmlFor='training-default-currency'>Currency</Label>
          <Select
            id='training-default-currency'
            value={value.defaultCurrency}
            disabled={disabled}
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
