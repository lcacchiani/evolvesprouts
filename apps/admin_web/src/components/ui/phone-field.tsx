'use client';

import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PHONE_COUNTRIES } from '@/lib/phone-countries.generated';

export interface PhoneFieldProps {
  region: string;
  national: string;
  onRegionChange: (region: string) => void;
  onNationalChange: (national: string) => void;
  regionLabel: string;
  nationalLabel: string;
  nationalInputId?: string;
}

export function PhoneField({
  region,
  national,
  onRegionChange,
  onNationalChange,
  regionLabel,
  nationalLabel,
  nationalInputId,
}: PhoneFieldProps) {
  const autoId = useId();
  const regionId = `${autoId}-region`;
  const nationalId = nationalInputId ?? `${autoId}-national`;

  return (
    <div className='grid gap-3 sm:grid-cols-2 sm:gap-4'>
      <div className='space-y-1.5'>
        <Label htmlFor={regionId}>{regionLabel}</Label>
        <Select
          id={regionId}
          value={region}
          onChange={(event) => onRegionChange(event.target.value)}
        >
          {PHONE_COUNTRIES.map((row) => (
            <option key={row.region} value={row.region}>
              {row.englishName} (+{row.dialCode})
            </option>
          ))}
        </Select>
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor={nationalId}>{nationalLabel}</Label>
        <Input
          id={nationalId}
          type='tel'
          inputMode='numeric'
          autoComplete='tel-national'
          value={national}
          onChange={(event) => onNationalChange(event.target.value)}
          onBlur={() => onNationalChange(national.replace(/\D/g, ''))}
        />
      </div>
    </div>
  );
}
