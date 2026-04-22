import type { LeadDetail } from '@/types/leads';

import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';

export interface LeadInfoSectionProps {
  lead: LeadDetail;
}

export function LeadInfoSection({ lead }: LeadInfoSectionProps) {
  return (
    <Card title='Lead Info' className='space-y-2'>
      <div className='grid grid-cols-1 gap-2 text-sm text-slate-700'>
        <p>
          <span className='font-medium text-slate-900'>Name:</span>{' '}
          {[lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(' ') || '—'}
        </p>
        <p>
          <span className='font-medium text-slate-900'>Email:</span> {lead.contact.email ?? '—'}
        </p>
        <p>
          <span className='font-medium text-slate-900'>Phone:</span> {lead.contact.phoneE164 ?? '—'}
        </p>
        <p>
          <span className='font-medium text-slate-900'>Instagram:</span>{' '}
          {lead.contact.instagramHandle ?? '—'}
        </p>
        <p>
          <span className='font-medium text-slate-900'>Source:</span>{' '}
          {lead.contact.source ? toTitleCase(lead.contact.source) : '—'}
        </p>
        <p>
          <span className='font-medium text-slate-900'>Lead type:</span> {toTitleCase(lead.leadType)}
        </p>
      </div>
    </Card>
  );
}
