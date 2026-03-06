'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { ServiceInstance } from '@/types/services';

export interface InstanceListPanelProps {
  instances: ServiceInstance[];
  selectedInstanceId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  onSelectInstance: (instanceId: string) => void;
  onLoadMore: () => Promise<void> | void;
  onOpenCreate: () => void;
}

export function InstanceListPanel({
  instances,
  selectedInstanceId,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onSelectInstance,
  onLoadMore,
  onOpenCreate,
}: InstanceListPanelProps) {
  return (
    <Card title='Instances'>
      <div className='mb-2 flex justify-end'>
        <Button type='button' size='sm' onClick={onOpenCreate}>
          New instance
        </Button>
      </div>
      {error ? <p className='mb-2 text-sm text-red-600'>{error}</p> : null}
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[720px] text-left text-sm'>
          <thead className='text-slate-500'>
            <tr>
              <th className='py-2 pr-3 font-medium'>Title</th>
              <th className='py-2 pr-3 font-medium'>Status</th>
              <th className='py-2 pr-3 font-medium'>Capacity</th>
              <th className='py-2 pr-3 font-medium'>Instructor</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance) => (
              <tr
                key={instance.id}
                className={`cursor-pointer border-t ${selectedInstanceId === instance.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                onClick={() => onSelectInstance(instance.id)}
              >
                <td className='py-2 pr-3'>{instance.resolvedTitle ?? '-'}</td>
                <td className='py-2 pr-3'>{instance.status}</td>
                <td className='py-2 pr-3'>
                  {instance.maxCapacity ?? 'unlimited'}
                </td>
                <td className='py-2 pr-3'>{instance.instructorId ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading ? <p className='mt-3 text-sm text-slate-500'>Loading instances...</p> : null}
      {hasMore ? (
        <div className='mt-3'>
          <Button type='button' variant='outline' onClick={() => void onLoadMore()} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
