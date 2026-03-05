'use client';

import { ActivityTimeline } from './activity-timeline';
import { LeadInfoSection } from './lead-info-section';
import { LeadQuickActions } from './lead-quick-actions';
import { NotesSection } from './notes-section';
import { StageControl } from './stage-control';

import type { AdminUser, FunnelStage, LeadDetail } from '@/types/leads';

import { Button } from '@/components/ui/button';

export interface LeadDetailPanelProps {
  open: boolean;
  lead: LeadDetail | null;
  users: AdminUser[];
  isLoading: boolean;
  onClose: () => void;
  onUpdateStage: (stage: FunnelStage, lostReason?: string) => Promise<void> | void;
  onAddNote: (content: string) => Promise<void> | void;
  onAssign: (assignedTo: string | null) => Promise<void> | void;
}

export function LeadDetailPanel({
  open,
  lead,
  users,
  isLoading,
  onClose,
  onUpdateStage,
  onAddNote,
  onAssign,
}: LeadDetailPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className='fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-xl'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-slate-900'>Lead details</h2>
        <Button type='button' variant='ghost' onClick={onClose}>
          ✕
        </Button>
      </div>
      {!lead ? (
        <p className='text-sm text-slate-600'>No lead selected.</p>
      ) : (
        <div className='space-y-4'>
          <LeadInfoSection lead={lead} />
          <StageControl
            currentStage={lead.funnelStage}
            isLoading={isLoading}
            onUpdateStage={onUpdateStage}
          />
          <LeadQuickActions
            lead={lead}
            users={users}
            isLoading={isLoading}
            onMarkConverted={() => onUpdateStage('converted')}
            onMarkLost={() => onUpdateStage('lost', 'Lost from quick action')}
            onAssign={onAssign}
          />
          <NotesSection notes={lead.notes} users={users} isLoading={isLoading} onAddNote={onAddNote} />
          <ActivityTimeline events={lead.events} users={users} />
        </div>
      )}
    </aside>
  );
}
