'use client';

import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/format';

import { EVENT_CATEGORIES } from '@/types/services';
import type { EventCategory } from '@/types/services';

export interface EventFormState {
  eventCategory: EventCategory;
}

export interface EventFormFieldsProps {
  value: EventFormState;
  disabled?: boolean;
  onChange: (value: EventFormState) => void;
  /**
   * With `layout="service-detail"`, renders one md+ row: optional `leadingColumn`,
   * event category, then `trailingSlot` (typically booking + cover as two grid cells).
   */
  layout?: 'default' | 'service-detail';
  leadingColumn?: ReactNode;
  trailingSlot?: ReactNode;
}

export function EventFormFields({
  value,
  disabled = false,
  onChange,
  layout = 'default',
  leadingColumn,
  trailingSlot,
}: EventFormFieldsProps) {
  const categoryField = (
    <div>
      <Label htmlFor='event-category'>Event category</Label>
      <Select
        id='event-category'
        value={value.eventCategory}
        disabled={disabled}
        onChange={(event) => onChange({ eventCategory: event.target.value as EventCategory })}
      >
        {EVENT_CATEGORIES.map((entry) => (
          <option key={entry} value={entry}>
            {formatEnumLabel(entry)}
          </option>
        ))}
      </Select>
    </div>
  );

  if (layout === 'service-detail') {
    return (
      <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
        {leadingColumn ? <div>{leadingColumn}</div> : null}
        {categoryField}
        {trailingSlot}
      </div>
    );
  }

  return categoryField;
}
