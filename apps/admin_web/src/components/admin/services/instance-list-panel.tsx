'use client';

import type { KeyboardEvent, MouseEvent } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DeleteIcon } from '@/components/icons/action-icons';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatEnumLabel } from '@/lib/format';

import type { ServiceInstance } from '@/types/services';

export interface InstanceListPanelProps {
  instances: ServiceInstance[];
  selectedInstanceId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  isMutating: boolean;
  onSelectInstance: (instanceId: string) => void;
  onLoadMore: () => Promise<void> | void;
  onDeleteInstance: (instanceId: string) => Promise<void>;
}

export function InstanceListPanel({
  instances,
  selectedInstanceId,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isMutating,
  onSelectInstance,
  onLoadMore,
  onDeleteInstance,
}: InstanceListPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, instanceId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectInstance(instanceId);
    }
  };

  const handleDeleteInstance = async (
    instance: ServiceInstance,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Delete instance',
      description: `Delete "${instance.resolvedTitle ?? instance.title ?? 'this instance'}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDeleteInstance(instance.id);
  };

  return (
    <>
      <PaginatedTableCard
        title='Existing Instances'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading instances...'
        onLoadMore={onLoadMore}
      >
        <table className='w-full min-w-[820px] text-left text-sm'>
          <thead className='text-slate-500'>
            <tr>
              <th className='py-2 pr-3 font-medium'>Title</th>
              <th className='py-2 pr-3 font-medium'>Status</th>
              <th className='py-2 pr-3 font-medium'>Capacity</th>
              <th className='py-2 pr-3 font-medium'>Instructor</th>
              <th className='py-2 pr-3 font-medium text-right'>Operations</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance) => (
              <tr
                key={instance.id}
                className={`cursor-pointer border-t ${
                  selectedInstanceId === instance.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => onSelectInstance(instance.id)}
                onKeyDown={(event) => handleRowKeyDown(event, instance.id)}
                tabIndex={0}
                role='row'
                aria-selected={selectedInstanceId === instance.id}
              >
                <td className='py-2 pr-3'>{instance.resolvedTitle ?? '-'}</td>
                <td className='py-2 pr-3'>{formatEnumLabel(instance.status)}</td>
                <td className='py-2 pr-3'>{instance.maxCapacity ?? 'unlimited'}</td>
                <td className='py-2 pr-3'>{instance.instructorId ?? '-'}</td>
                <td className='py-2 pr-3 text-right'>
                  <Button
                    type='button'
                    size='sm'
                    variant='danger'
                    onClick={(event) => void handleDeleteInstance(instance, event)}
                    disabled={isMutating}
                    aria-label='Delete instance'
                    title='Delete instance'
                  >
                    <DeleteIcon className='h-4 w-4' />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
