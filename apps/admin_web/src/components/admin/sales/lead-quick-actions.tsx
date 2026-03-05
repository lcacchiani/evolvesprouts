'use client';

import type { AdminUser, LeadDetail } from '@/types/leads';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

export interface LeadQuickActionsProps {
  lead: LeadDetail;
  users: AdminUser[];
  isLoading: boolean;
  onMarkConverted: () => Promise<void> | void;
  onMarkLost: (lostReason: string) => Promise<void> | void;
  onAssign: (assignedTo: string | null) => Promise<void> | void;
}

export function LeadQuickActions({
  lead,
  users,
  isLoading,
  onMarkConverted,
  onMarkLost,
  onAssign,
}: LeadQuickActionsProps) {
  return (
    <Card title='Quick actions' className='space-y-3'>
      <div className='flex flex-wrap gap-2'>
        {lead.contact.email ? (
          <a
            href={`mailto:${lead.contact.email}`}
            className='inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50'
          >
            Send email
          </a>
        ) : null}
        <Button type='button' variant='outline' disabled={isLoading} onClick={() => void onMarkConverted()}>
          Mark converted
        </Button>
        <Button
          type='button'
          variant='danger'
          disabled={isLoading}
          onClick={() => {
            const lostReason = window.prompt('Why was this lead lost?')?.trim();
            if (!lostReason) {
              return;
            }
            void onMarkLost(lostReason);
          }}
        >
          Mark lost
        </Button>
      </div>
      <Select
        value={lead.assignedTo ?? ''}
        onChange={(event) => void onAssign(event.target.value || null)}
        disabled={isLoading}
      >
        <option value=''>Unassigned</option>
        {users.map((user) => (
          <option key={user.sub} value={user.sub}>
            {user.name || user.email || user.sub}
          </option>
        ))}
      </Select>
    </Card>
  );
}
