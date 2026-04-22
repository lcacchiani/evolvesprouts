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
   * When set with `layout="service-detail"`, renders a single md+ row of equal
   * columns: optional leading column (e.g. delivery mode), optional column before
   * pricing unit (e.g. instance instructor), then pricing unit, price, and currency.
   */
  leadingColumn?: ReactNode;
  /** Renders immediately before the pricing unit column when `layout="service-detail"`. */
  prePricingUnitColumn?: ReactNode;
  layout?: 'default' | 'service-detail';
}

export function TrainingFormFields({
  value,
  disabled = false,
  onChange,
  leadingColumn,
  prePricingUnitColumn,
  layout = 'default',
}: TrainingFormFieldsProps) {
  const currencyOptions = getCurrencyOptions();

  const hasLeading = layout === 'service-detail' && Boolean(leadingColumn);
  const hasPrePricing = layout === 'service-detail' && Boolean(prePricingUnitColumn);
  const serviceDetailColumnCount = (hasLeading ? 1 : 0) + (hasPrePricing ? 1 : 0) + 3;

  const pricingGridClass =
    layout === 'service-detail'
      ? serviceDetailColumnCount <= 3
        ? 'grid grid-cols-1 gap-3 sm:grid-cols-3'
        : serviceDetailColumnCount === 4
          ? 'grid grid-cols-1 gap-3 md:grid-cols-4'
          : serviceDetailColumnCount === 5
            ? 'grid grid-cols-1 gap-3 md:grid-cols-5'
            : 'grid grid-cols-1 gap-3 md:grid-cols-6'
      : 'grid grid-cols-1 gap-3 sm:grid-cols-3';

  return (
    <div className='space-y-3'>
      <div className={pricingGridClass}>
        {hasLeading ? <div>{leadingColumn}</div> : null}
        {hasPrePricing ? <div>{prePricingUnitColumn}</div> : null}
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
          <Label htmlFor='training-default-price'>Price</Label>
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
