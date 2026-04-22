'use client';

import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
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
  /** When true, category is shown read-only (inherited from parent service). */
  categoryReadOnly?: boolean;
  /** Optional id for the category control (read-only input or select). */
  categoryFieldId?: string;
  /**
   * With `layout="service-detail"`, renders one md+ row: optional `leadingColumn`,
   * event category, then `trailingSlot` (typically booking + cover as two grid cells).
   * With `layout="instance-detail"`, category spans three quarters and `trailingSlot` one quarter on large screens.
   */
  layout?: 'default' | 'service-detail' | 'instance-detail';
  leadingColumn?: ReactNode;
  trailingSlot?: ReactNode;
}

export function EventFormFields({
  value,
  disabled = false,
  onChange,
  categoryReadOnly = false,
  categoryFieldId = 'event-category',
  layout = 'default',
  leadingColumn,
  trailingSlot,
}: EventFormFieldsProps) {
  const categoryField = categoryReadOnly ? (
    <div>
      <Label htmlFor={categoryFieldId}>Event category</Label>
      <Input
        id={categoryFieldId}
        readOnly
        value={formatEnumLabel(value.eventCategory)}
        className='bg-slate-50 text-slate-700'
      />
    </div>
  ) : (
    <div>
      <Label htmlFor={categoryFieldId}>Event category</Label>
      <Select
        id={categoryFieldId}
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

  if (layout === 'instance-detail') {
    return (
      <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
        {leadingColumn ? <div className='lg:col-span-12'>{leadingColumn}</div> : null}
        <div className='lg:col-span-9'>{categoryField}</div>
        {trailingSlot ? <div className='lg:col-span-3'>{trailingSlot}</div> : null}
      </div>
    );
  }

  return categoryField;
}
