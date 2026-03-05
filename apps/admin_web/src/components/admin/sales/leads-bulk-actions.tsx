'use client';

import { useState } from 'react';

import type { AdminUser, FunnelStage } from '@/types/leads';
import { FUNNEL_STAGES } from '@/types/leads';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface LeadsBulkActionsProps {
  selectedCount: number;
  users: AdminUser[];
  onBulkAssign: (assignedTo: string | null) => void;
  onBulkStageChange: (stage: FunnelStage, lostReason?: string) => void;
}

export function LeadsBulkActions({
  selectedCount,
  users,
  onBulkAssign,
  onBulkStageChange,
}: LeadsBulkActionsProps) {
  const [pendingStage, setPendingStage] = useState<FunnelStage | ''>('');
  const [lostReason, setLostReason] = useState('');

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
          value={pendingStage}
          onChange={(event) => {
            const stage = event.target.value as FunnelStage | '';
            if (!stage) {
              setPendingStage('');
              return;
            }
            setPendingStage(stage);
            if (stage !== 'lost') {
              onBulkStageChange(stage);
              setPendingStage('');
              setLostReason('');
            }
          }}
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
      {pendingStage === 'lost' ? (
        <div className='mt-2 space-y-2'>
          <Textarea
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value)}
            placeholder='Lost reason (required for bulk lost)'
          />
          <div className='flex gap-2'>
            <Button
              type='button'
              disabled={lostReason.trim().length === 0}
              onClick={() => {
                onBulkStageChange('lost', lostReason.trim());
                setLostReason('');
                setPendingStage('');
              }}
            >
              Confirm lost stage
            </Button>
            <Button
              type='button'
              variant='ghost'
              onClick={() => {
                setLostReason('');
                setPendingStage('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
