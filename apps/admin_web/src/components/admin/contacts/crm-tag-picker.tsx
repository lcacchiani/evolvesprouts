'use client';

import { useState } from 'react';

import { Label } from '@/components/ui/label';

import type { CrmTagRef } from '@/lib/crm-api';

export interface CrmTagPickerProps {
  id: string;
  label: string;
  tags: CrmTagRef[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** When set, the picker is hidden behind a disclosure (same pattern as structured JSON fields elsewhere in admin). */
  variant?: 'default' | 'collapsible';
}

export function CrmTagPicker({
  id,
  label,
  tags,
  selectedIds,
  onChange,
  disabled,
  variant = 'default',
}: CrmTagPickerProps) {
  const set = new Set(selectedIds);
  const [disclosureOpen, setDisclosureOpen] = useState(false);

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

  const list = (
    <div className='max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3'>
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
  );

  if (variant === 'collapsible') {
    const panelId = `${id}-panel`;
    return (
      <fieldset disabled={disabled}>
        <details
          className='rounded-md border border-slate-200 bg-white'
          open={disclosureOpen}
          onToggle={(event) => {
            setDisclosureOpen(event.currentTarget.open);
          }}
        >
          <summary
            className='cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50'
            aria-controls={panelId}
          >
            {label}
          </summary>
          <div className='border-t border-slate-200 px-3 pb-3 pt-2' id={panelId}>
            {list}
          </div>
        </details>
      </fieldset>
    );
  }

  return (
    <fieldset disabled={disabled} className='space-y-2'>
      <legend className='text-sm font-medium text-slate-800'>{label}</legend>
      {list}
    </fieldset>
  );
}
