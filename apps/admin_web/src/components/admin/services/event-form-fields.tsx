'use client';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { EVENT_CATEGORIES } from '@/types/services';
import type { EventCategory } from '@/types/services';

export interface EventFormState {
  eventCategory: EventCategory;
}

export interface EventFormFieldsProps {
  value: EventFormState;
  onChange: (value: EventFormState) => void;
}

export function EventFormFields({ value, onChange }: EventFormFieldsProps) {
  return (
    <div>
      <Label htmlFor='event-category'>Event category</Label>
      <Select
        id='event-category'
        value={value.eventCategory}
        onChange={(event) => onChange({ eventCategory: event.target.value as EventCategory })}
      >
        {EVENT_CATEGORIES.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </Select>
    </div>
  );
}
