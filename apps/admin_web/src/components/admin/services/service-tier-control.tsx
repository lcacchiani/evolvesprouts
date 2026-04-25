'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ServiceTierControlProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  tierConflictError?: string;
}

export function ServiceTierControl({
  value,
  onChange,
  id = 'service-tier',
  disabled = false,
  invalid = false,
  tierConflictError,
}: ServiceTierControlProps) {
  return (
    <div>
      <Label htmlFor={id}>Service tier</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(value.trim().toLowerCase())}
        placeholder='e.g. ages-3-5'
        maxLength={128}
        autoComplete='off'
      />
      {invalid ? (
        <p className='mt-1 text-xs text-red-600'>
          Use lowercase letters and numbers, with single hyphens between segments (no leading or trailing hyphen).
        </p>
      ) : null}
      {tierConflictError ? <p className='mt-1 text-xs text-red-600'>{tierConflictError}</p> : null}
    </div>
  );
}
