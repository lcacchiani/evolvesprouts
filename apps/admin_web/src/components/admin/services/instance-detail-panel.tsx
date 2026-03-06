'use client';

import { Card } from '@/components/ui/card';

import type { ServiceInstance } from '@/types/services';

export interface InstanceDetailPanelProps {
  instance: ServiceInstance | null;
}

export function InstanceDetailPanel({ instance }: InstanceDetailPanelProps) {
  if (!instance) {
    return (
      <Card title='Instance detail'>
        <p className='text-sm text-slate-500'>Select an instance to view details.</p>
      </Card>
    );
  }

  return (
    <Card title='Instance detail'>
      <dl className='grid grid-cols-1 gap-2 text-sm sm:grid-cols-2'>
        <div>
          <dt className='text-slate-500'>ID</dt>
          <dd className='break-all'>{instance.id}</dd>
        </div>
        <div>
          <dt className='text-slate-500'>Status</dt>
          <dd>{instance.status}</dd>
        </div>
        <div>
          <dt className='text-slate-500'>Resolved title</dt>
          <dd>{instance.resolvedTitle ?? '-'}</dd>
        </div>
        <div>
          <dt className='text-slate-500'>Delivery mode</dt>
          <dd>{instance.resolvedDeliveryMode ?? '-'}</dd>
        </div>
        <div className='sm:col-span-2'>
          <dt className='text-slate-500'>Notes</dt>
          <dd>{instance.notes ?? '-'}</dd>
        </div>
      </dl>
    </Card>
  );
}
