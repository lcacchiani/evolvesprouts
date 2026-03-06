'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatEnumLabel, getCurrencyOptions } from '@/lib/format';

import { CONSULTATION_FORMATS, CONSULTATION_PRICING_MODELS } from '@/types/services';
import type { ConsultationFormat, ConsultationPricingModel } from '@/types/services';

export interface ConsultationFormState {
  consultationFormat: ConsultationFormat;
  maxGroupSize: string;
  durationMinutes: string;
  pricingModel: ConsultationPricingModel;
  defaultHourlyRate: string;
  defaultPackagePrice: string;
  defaultPackageSessions: string;
  defaultCurrency: string;
  calendlyUrl: string;
}

export interface ConsultationFormFieldsProps {
  value: ConsultationFormState;
  onChange: (value: ConsultationFormState) => void;
}

export function ConsultationFormFields({ value, onChange }: ConsultationFormFieldsProps) {
  const currencyOptions = getCurrencyOptions();

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
      <div>
        <Label htmlFor='consultation-format'>Consultation format</Label>
        <Select
          id='consultation-format'
          value={value.consultationFormat}
          onChange={(event) =>
            onChange({ ...value, consultationFormat: event.target.value as ConsultationFormat })
          }
        >
          {CONSULTATION_FORMATS.map((entry) => (
            <option key={entry} value={entry}>
              {formatEnumLabel(entry)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor='consultation-pricing-model'>Pricing model</Label>
        <Select
          id='consultation-pricing-model'
          value={value.pricingModel}
          onChange={(event) =>
            onChange({ ...value, pricingModel: event.target.value as ConsultationPricingModel })
          }
        >
          {CONSULTATION_PRICING_MODELS.map((entry) => (
            <option key={entry} value={entry}>
              {formatEnumLabel(entry)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor='consultation-max-group-size'>Max group size</Label>
        <Input
          id='consultation-max-group-size'
          value={value.maxGroupSize}
          onChange={(event) => onChange({ ...value, maxGroupSize: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor='consultation-duration-minutes'>Duration minutes</Label>
        <Input
          id='consultation-duration-minutes'
          value={value.durationMinutes}
          onChange={(event) => onChange({ ...value, durationMinutes: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor='consultation-hourly-rate'>Default hourly rate</Label>
        <Input
          id='consultation-hourly-rate'
          value={value.defaultHourlyRate}
          onChange={(event) => onChange({ ...value, defaultHourlyRate: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor='consultation-package-price'>Default package price</Label>
        <Input
          id='consultation-package-price'
          value={value.defaultPackagePrice}
          onChange={(event) => onChange({ ...value, defaultPackagePrice: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor='consultation-package-sessions'>Default package sessions</Label>
        <Input
          id='consultation-package-sessions'
          value={value.defaultPackageSessions}
          onChange={(event) => onChange({ ...value, defaultPackageSessions: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor='consultation-currency'>Currency</Label>
        <Select
          id='consultation-currency'
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
      <div className='sm:col-span-2'>
        <Label htmlFor='consultation-calendly-url'>Calendly URL</Label>
        <Input
          id='consultation-calendly-url'
          value={value.calendlyUrl}
          onChange={(event) => onChange({ ...value, calendlyUrl: event.target.value })}
        />
      </div>
    </div>
  );
}
