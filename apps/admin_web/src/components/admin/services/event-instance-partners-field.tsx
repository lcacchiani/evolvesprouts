'use client';

import { useEffect, useMemo, useState } from 'react';

import { Label } from '@/components/ui/label';
import { listEntityPartnerOrganizationPicker } from '@/lib/entity-api';

import type { PartnerOrgRef } from '@/types/services';

export interface EventInstancePartnersFieldProps {
  value: PartnerOrgRef[];
  onChange: (next: PartnerOrgRef[]) => void;
  disabled?: boolean;
}

export function EventInstancePartnersField({
  value,
  onChange,
  disabled = false,
}: EventInstancePartnersFieldProps) {
  const [pickerItems, setPickerItems] = useState<{ id: string; label: string }[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void listEntityPartnerOrganizationPicker()
      .then((items) => {
        if (!cancelled) {
          setPickerItems(items.map((row) => ({ id: row.id, label: row.label })));
          setLoadError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load partner organisations.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickerIdSet = useMemo(() => new Set(pickerItems.map((row) => row.id)), [pickerItems]);

  const selectedIds = useMemo(() => value.map((row) => row.id), [value]);

  const optionRows = useMemo(() => {
    const rows: { id: string; label: string; disabled: boolean; sticky: boolean }[] = pickerItems.map(
      (row) => ({ id: row.id, label: row.label, disabled: false, sticky: false })
    );
    for (const ref of value) {
      if (!pickerIdSet.has(ref.id)) {
        rows.push({
          id: ref.id,
          label: `${ref.name} (archived)`,
          disabled: true,
          sticky: true,
        });
      }
    }
    return rows;
  }, [pickerItems, pickerIdSet, value]);

  return (
    <div className='space-y-2'>
      <Label htmlFor='event-instance-partner-orgs'>Partner organisations</Label>
      {loadError ? <p className='text-xs text-amber-700'>{loadError}</p> : null}
      <div className='flex min-h-8 flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1'>
        {value.length === 0 ? (
          <span className='text-xs text-slate-500'>None selected</span>
        ) : (
          value.map((ref) => (
            <span
              key={ref.id}
              className='inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-800'
            >
              {ref.name}
              {!ref.active ? ' (archived)' : ''}
            </span>
          ))
        )}
      </div>
      <select
        id='event-instance-partner-orgs'
        multiple
        disabled={disabled}
        className='min-h-28 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm'
        value={selectedIds}
        onChange={(event) => {
          const selected = new Set(
            Array.from(event.target.selectedOptions, (option) => option.value)
          );
          const next: PartnerOrgRef[] = [];
          for (const id of selected) {
            const fromValue = value.find((row) => row.id === id);
            if (fromValue) {
              next.push(fromValue);
              continue;
            }
            const fromPicker = pickerItems.find((row) => row.id === id);
            if (fromPicker) {
              next.push({ id: fromPicker.id, name: fromPicker.label, active: true });
            }
          }
          onChange(next);
        }}
      >
        {optionRows.map((row) => (
          <option key={`${row.id}-${row.sticky ? 'sticky' : 'live'}`} value={row.id} disabled={row.disabled}>
            {row.label}
          </option>
        ))}
      </select>
      <p className='text-xs text-slate-500'>Hold Ctrl or Cmd to select multiple partners.</p>
    </div>
  );
}
