'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { SessionSlot } from '@/types/services';

export interface SessionSlotEditorProps {
  slots: SessionSlot[];
  onChange: (slots: SessionSlot[]) => void;
}

function emptySlot(sortOrder: number): SessionSlot {
  return {
    id: null,
    instanceId: null,
    locationId: null,
    startsAt: null,
    endsAt: null,
    sortOrder,
  };
}

export function SessionSlotEditor({ slots, onChange }: SessionSlotEditorProps) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <Label>Session slots</Label>
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => onChange([...slots, emptySlot(slots.length)])}
        >
          Add slot
        </Button>
      </div>
      {slots.length === 0 ? <p className='text-sm text-slate-500'>No slots configured.</p> : null}
      <div className='space-y-2'>
        {slots.map((slot, index) => (
          <div key={`${slot.id ?? 'new'}-${index}`} className='grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-5'>
            <Input
              type='datetime-local'
              value={(slot.startsAt ?? '').slice(0, 16)}
              onChange={(event) => {
                const next = [...slots];
                next[index] = { ...slot, startsAt: event.target.value || null };
                onChange(next);
              }}
            />
            <Input
              type='datetime-local'
              value={(slot.endsAt ?? '').slice(0, 16)}
              onChange={(event) => {
                const next = [...slots];
                next[index] = { ...slot, endsAt: event.target.value || null };
                onChange(next);
              }}
            />
            <Input
              value={slot.locationId ?? ''}
              onChange={(event) => {
                const next = [...slots];
                next[index] = { ...slot, locationId: event.target.value || null };
                onChange(next);
              }}
              placeholder='Location UUID'
            />
            <Input
              type='number'
              value={slot.sortOrder ?? index}
              onChange={(event) => {
                const next = [...slots];
                next[index] = { ...slot, sortOrder: Number(event.target.value) };
                onChange(next);
              }}
            />
            <Button
              type='button'
              variant='ghost'
              onClick={() => onChange(slots.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
