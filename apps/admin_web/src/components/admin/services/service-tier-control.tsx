'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ServiceTierControlProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

export function ServiceTierControl({ value, onChange, id = 'service-tier', disabled = false }: ServiceTierControlProps) {
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
      <p className='mt-1 text-xs text-slate-500'>Lowercase letters, digits, and hyphens. Max 128 characters.</p>
    </div>
  );
}
