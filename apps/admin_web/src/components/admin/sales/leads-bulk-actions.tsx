'use client';

import type { AdminUser, FunnelStage } from '@/types/leads';
import { FUNNEL_STAGES } from '@/types/leads';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

export interface LeadsBulkActionsProps {
  selectedCount: number;
  users: AdminUser[];
  onBulkAssign: (assignedTo: string | null) => void;
  onBulkStageChange: (stage: FunnelStage) => void;
}

export function LeadsBulkActions({
  selectedCount,
  users,
  onBulkAssign,
  onBulkStageChange,
}: LeadsBulkActionsProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className='flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between'>
      <p className='text-sm text-slate-700'>{selectedCount} lead(s) selected</p>
      <div className='grid grid-cols-1 gap-2 md:grid-cols-3'>
        <Select onChange={(event) => onBulkAssign(event.target.value || null)} defaultValue=''>
          <option value=''>Assign to...</option>
          <option value='__none__'>Unassign</option>
          {users.map((user) => (
            <option key={user.sub} value={user.sub}>
              {user.name || user.email || user.sub}
            </option>
          ))}
        </Select>
        <Select
          onChange={(event) => {
            if (event.target.value) {
              onBulkStageChange(event.target.value as FunnelStage);
            }
          }}
          defaultValue=''
        >
          <option value=''>Set stage...</option>
          {FUNNEL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </Select>
        <Button type='button' variant='outline' onClick={() => onBulkAssign(null)}>
          Clear assignee
        </Button>
      </div>
    </div>
  );
}
