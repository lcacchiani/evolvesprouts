'use client';

import type { KeyboardEvent, MouseEvent } from 'react';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatDate, formatEnumLabel } from '@/lib/format';

import { SERVICE_STATUSES, SERVICE_TYPES } from '@/types/services';
import type { ServiceListFilters, ServiceSummary } from '@/types/services';

export interface ServiceListPanelProps {
  services: ServiceSummary[];
  selectedServiceId: string | null;
  filters: ServiceListFilters;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  isMutating: boolean;
  onSelectService: (serviceId: string) => void;
  onFilterChange: <TKey extends keyof ServiceListFilters>(
    key: TKey,
    value: ServiceListFilters[TKey]
  ) => void;
  onLoadMore: () => Promise<void> | void;
  onDeleteService: (serviceId: string) => Promise<void>;
}

export function ServiceListPanel({
  services,
  selectedServiceId,
  filters,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isMutating,
  onSelectService,
  onFilterChange,
  onLoadMore,
  onDeleteService,
}: ServiceListPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, serviceId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectService(serviceId);
    }
  };

  const handleDeleteService = async (service: ServiceSummary, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Delete service',
      description: `Delete "${service.title}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDeleteService(service.id);
  };

  return (
    <>
      <PaginatedTableCard
        title='Existing Services'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading services...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3'>
            <Select
              value={filters.serviceType}
              onChange={(event) =>
                onFilterChange('serviceType', event.target.value as ServiceListFilters['serviceType'])
              }
            >
              <option value=''>All types</option>
              {SERVICE_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
            <Select
              value={filters.status}
              onChange={(event) => onFilterChange('status', event.target.value as ServiceListFilters['status'])}
            >
              <option value=''>All statuses</option>
              {SERVICE_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
            <Input
              value={filters.search}
              onChange={(event) => onFilterChange('search', event.target.value)}
              placeholder='Search title/description'
            />
          </div>
        }
      >
        <table className='w-full min-w-[840px] text-left text-sm'>
          <thead className='text-slate-500'>
            <tr>
              <th className='py-2 pr-3 font-medium'>Title</th>
              <th className='py-2 pr-3 font-medium'>Type</th>
              <th className='py-2 pr-3 font-medium'>Status</th>
              <th className='py-2 pr-3 font-medium'>Delivery</th>
              <th className='py-2 pr-3 font-medium'>Created</th>
              <th className='py-2 pr-3 font-medium text-right'>Operations</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr
                key={service.id}
                className={`cursor-pointer border-t ${
                  selectedServiceId === service.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => onSelectService(service.id)}
                onKeyDown={(event) => handleRowKeyDown(event, service.id)}
                tabIndex={0}
                role='row'
                aria-selected={selectedServiceId === service.id}
              >
                <td className='py-2 pr-3'>{service.title}</td>
                <td className='py-2 pr-3'>{formatEnumLabel(service.serviceType)}</td>
                <td className='py-2 pr-3'>{formatEnumLabel(service.status)}</td>
                <td className='py-2 pr-3'>{formatEnumLabel(service.deliveryMode)}</td>
                <td className='py-2 pr-3'>{formatDate(service.createdAt)}</td>
                <td className='py-2 pr-3 text-right'>
                  <Button
                    type='button'
                    size='sm'
                    variant='danger'
                    onClick={(event) => void handleDeleteService(service, event)}
                    disabled={isMutating}
                    aria-label='Delete service'
                    title='Delete service'
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
