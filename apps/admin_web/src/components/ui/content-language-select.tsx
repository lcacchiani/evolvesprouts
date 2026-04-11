'use client';

import { useMemo } from 'react';

import { getContentLanguageOptions } from '@/lib/format';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export interface ContentLanguageSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** When set, forwarded to the select (e.g. for expense-linked assets). */
  'aria-label'?: string;
  title?: string;
}

/**
 * Reusable content-language dropdown for admin forms (same usage pattern as currency selects).
 * Values are BCP 47 tags: en, zh-CN, zh-HK.
 */
export function ContentLanguageSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  title,
}: ContentLanguageSelectProps) {
  const options = useMemo(() => getContentLanguageOptions(), []);

  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value=''>Not set</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
