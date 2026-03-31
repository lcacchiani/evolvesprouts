'use client';

import { Label } from '@/components/ui/label';

import type { CrmTagRef } from '@/lib/crm-api';

export interface CrmTagPickerProps {
  id: string;
  label: string;
  tags: CrmTagRef[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function CrmTagPicker({ id, label, tags, selectedIds, onChange, disabled }: CrmTagPickerProps) {
  const set = new Set(selectedIds);

  function toggle(tagId: string) {
    const next = new Set(set);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    onChange([...next]);
  }

  if (tags.length === 0) {
    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p id={id} className='text-sm text-slate-500'>
          No tags in the database yet.
        </p>
      </div>
    );
  }

  return (
    <fieldset disabled={disabled} className='space-y-2'>
      <legend className='text-sm font-medium text-slate-800'>{label}</legend>
      <div className='max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3'>
        {tags.map((tag) => (
          <label key={tag.id} className='flex cursor-pointer items-center gap-2 text-sm'>
            <input
              type='checkbox'
              className='h-4 w-4 rounded border-slate-300'
              checked={set.has(tag.id)}
              onChange={() => toggle(tag.id)}
            />
            <span>{tag.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
