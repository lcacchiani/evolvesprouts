'use client';

import type { AdminUser, LeadSummary } from '@/types/leads';

import { ArrowRightIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { formatDate, formatEnumLabel } from '@/lib/format';

import { getStageBadgeClass } from './stage-utils';

export interface LeadsTableRowProps {
  lead: LeadSummary;
  users: AdminUser[];
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (leadId: string) => void;
  onCheck: (leadId: string, checked: boolean) => void;
}

function resolveAssigneeLabel(assignedTo: string | null, users: AdminUser[]): string {
  if (!assignedTo) {
    return 'Unassigned';
  }
  const user = users.find((entry) => entry.sub === assignedTo);
  return user?.name || user?.email || assignedTo;
}

export function LeadsTableRow({
  lead,
  users,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
}: LeadsTableRowProps) {
  return (
    <tr
      key={lead.id}
      className={`cursor-pointer ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
      onClick={() => onSelect(lead.id)}
    >
      <td className='px-3 py-2' onClick={(event) => event.stopPropagation()}>
        <input
          type='checkbox'
          checked={isChecked}
          onChange={(event) => onCheck(lead.id, event.target.checked)}
        />
      </td>
      <td className='px-3 py-2 text-sm font-medium text-slate-900'>
        {[lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(' ') || 'Unnamed lead'}
      </td>
      <td className='px-3 py-2 text-sm text-slate-700'>{lead.contact.email ?? '—'}</td>
      <td className='px-3 py-2 text-sm text-slate-700'>
        {lead.contact.source ? formatEnumLabel(lead.contact.source) : '—'}
      </td>
      <td className='px-3 py-2 text-sm'>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStageBadgeClass(lead.funnelStage)}`}
        >
          {formatEnumLabel(lead.funnelStage)}
        </span>
      </td>
      <td className='px-3 py-2 text-sm text-slate-700'>
        {resolveAssigneeLabel(lead.assignedTo, users)}
      </td>
      <td className='px-3 py-2 text-sm text-slate-700'>{formatDate(lead.createdAt)}</td>
      <td className='px-3 py-2 text-sm text-slate-700'>
        <span className={lead.daysInStage > 7 ? 'font-semibold text-amber-700' : ''}>
          {lead.daysInStage}
        </span>
      </td>
      <td className='px-3 py-2 text-right' onClick={(event) => event.stopPropagation()}>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          onClick={() => onSelect(lead.id)}
          aria-label='Open lead'
          title='Open lead'
        >
          <ArrowRightIcon className='h-4 w-4' />
        </Button>
      </td>
    </tr>
  );
}
