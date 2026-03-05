'use client';

import type { LeadSummary } from '@/types/leads';

import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';

import { getStageBadgeClass } from './stage-utils';

export interface LeadsTableRowProps {
  lead: LeadSummary;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (leadId: string) => void;
  onCheck: (leadId: string, checked: boolean) => void;
}

export function LeadsTableRow({
  lead,
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
      <td className='px-3 py-2 text-sm text-slate-700'>{lead.contact.source ?? '—'}</td>
      <td className='px-3 py-2 text-sm'>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStageBadgeClass(lead.funnelStage)}`}
        >
          {lead.funnelStage}
        </span>
      </td>
      <td className='px-3 py-2 text-sm text-slate-700'>{lead.assignedTo ?? 'Unassigned'}</td>
      <td className='px-3 py-2 text-sm text-slate-700'>{formatDate(lead.createdAt)}</td>
      <td className='px-3 py-2 text-sm text-slate-700'>
        <span className={lead.daysInStage > 7 ? 'font-semibold text-amber-700' : ''}>
          {lead.daysInStage}
        </span>
      </td>
      <td className='px-3 py-2 text-right' onClick={(event) => event.stopPropagation()}>
        <Button type='button' size='sm' variant='ghost' onClick={() => onSelect(lead.id)}>
          Open
        </Button>
      </td>
    </tr>
  );
}
