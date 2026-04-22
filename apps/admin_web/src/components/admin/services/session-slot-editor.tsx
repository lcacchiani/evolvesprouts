'use client';

import { DeleteIcon } from '@/components/icons/action-icons';
import { AdminCollapsibleSection } from '@/components/ui/admin-collapsible-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatLocationLabel } from '@/lib/format';

import type { LocationSummary, SessionSlot } from '@/types/services';

export interface SessionSlotEditorProps {
  slots: SessionSlot[];
  disabled?: boolean;
  locationOptions?: LocationSummary[];
  isLoadingLocations?: boolean;
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

export function SessionSlotEditor({
  slots,
  disabled = false,
  locationOptions = [],
  isLoadingLocations = false,
  onChange,
}: SessionSlotEditorProps) {
  const hasLocationOptions = locationOptions.length > 0;

  const slotGridClassName =
    'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-[1fr_1fr_1fr_minmax(0,5.5rem)_auto] sm:items-end';

  return (
    <AdminCollapsibleSection id='service-instance-session-slots' title='Session slots' disabled={disabled}>
      <div className='grid grid-rows-[auto_1fr_auto] gap-3'>
        <div className='min-h-0'>
          {slots.length === 0 ? <p className='text-sm text-slate-500'>No slots configured.</p> : null}
        </div>
        <div className='flex min-h-0 flex-col gap-3 overflow-y-auto'>
          {slots.map((slot, index) => (
            <div key={`${slot.id ?? 'new'}-${index}`} className={slotGridClassName}>
              <div className='space-y-1'>
                <Label className='text-xs font-medium text-slate-600' htmlFor={`slot-${index}-starts`}>
                  Start time
                </Label>
                <Input
                  id={`slot-${index}-starts`}
                  type='datetime-local'
                  disabled={disabled}
                  aria-label='Start time'
                  value={(slot.startsAt ?? '').slice(0, 16)}
                  onChange={(event) => {
                    const next = [...slots];
                    next[index] = { ...slot, startsAt: event.target.value || null };
                    onChange(next);
                  }}
                />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs font-medium text-slate-600' htmlFor={`slot-${index}-ends`}>
                  End time
                </Label>
                <Input
                  id={`slot-${index}-ends`}
                  type='datetime-local'
                  disabled={disabled}
                  aria-label='End time'
                  value={(slot.endsAt ?? '').slice(0, 16)}
                  onChange={(event) => {
                    const next = [...slots];
                    next[index] = { ...slot, endsAt: event.target.value || null };
                    onChange(next);
                  }}
                />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs font-medium text-slate-600' htmlFor={`slot-${index}-location`}>
                  Location
                </Label>
                {hasLocationOptions || isLoadingLocations ? (
                  <Select
                    id={`slot-${index}-location`}
                    disabled={disabled}
                    aria-label='Location'
                    value={slot.locationId ?? ''}
                    onChange={(event) => {
                      const next = [...slots];
                      next[index] = { ...slot, locationId: event.target.value || null };
                      onChange(next);
                    }}
                  >
                    <option value=''>
                      {isLoadingLocations ? 'Loading locations...' : 'None'}
                    </option>
                    {slot.locationId &&
                    !locationOptions.some((loc) => loc.id === slot.locationId) ? (
                      <option value={slot.locationId}>{slot.locationId}</option>
                    ) : null}
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {formatLocationLabel(location)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={`slot-${index}-location`}
                    disabled={disabled}
                    aria-label='Location'
                    value={slot.locationId ?? ''}
                    onChange={(event) => {
                      const next = [...slots];
                      next[index] = { ...slot, locationId: event.target.value || null };
                      onChange(next);
                    }}
                    placeholder='Location UUID'
                  />
                )}
              </div>
              <div className='space-y-1'>
                <Label className='text-xs font-medium text-slate-600' htmlFor={`slot-${index}-sort`}>
                  Sort order
                </Label>
                <Input
                  id={`slot-${index}-sort`}
                  type='number'
                  disabled={disabled}
                  aria-label='Sort order'
                  value={slot.sortOrder ?? index}
                  onChange={(event) => {
                    const next = [...slots];
                    next[index] = { ...slot, sortOrder: Number(event.target.value) };
                    onChange(next);
                  }}
                />
              </div>
              <div className='flex justify-end pb-0.5 sm:justify-start'>
                <Button
                  type='button'
                  variant='danger'
                  size='sm'
                  disabled={disabled}
                  className='min-w-8 px-2'
                  aria-label='Delete session slot'
                  title='Delete session slot'
                  onClick={() => onChange(slots.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <DeleteIcon className='h-4 w-4' />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className='flex justify-start justify-self-start'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={disabled}
            onClick={() => onChange([...slots, emptySlot(slots.length)])}
          >
            Add slot
          </Button>
        </div>
      </div>
    </AdminCollapsibleSection>
  );
}
