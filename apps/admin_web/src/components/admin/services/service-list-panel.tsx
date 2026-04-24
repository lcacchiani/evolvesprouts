'use client';

import type { KeyboardEvent, MouseEvent } from 'react';

import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyFeedbackIconButton } from '@/components/ui/copy-feedback-icon-button';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { DeleteIcon, DuplicateIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useCopyFeedback } from '@/hooks/use-copy-feedback';
import { formatEnumLabel, formatServiceListPriceLabel } from '@/lib/format';

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
  /** Resolve true when the draft flow started (e.g. service loaded); omit feedback on failure. */
  onDuplicateService: (serviceId: string) => Promise<boolean> | boolean | void;
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
  onDuplicateService,
  onDeleteService,
}: ServiceListPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const { copiedKey: duplicateDraftFeedbackId, markCopied: markDuplicateDraftFeedback } = useCopyFeedback(1000);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, serviceId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectService(serviceId);
    }
  };

  const handleDuplicateService = async (service: ServiceSummary, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const started = await onDuplicateService(service.id);
    if (started === true) {
      markDuplicateDraftFeedback(service.id);
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
        title='Services'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading services...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='services-filter-search'>Search</Label>
              <Input
                id='services-filter-search'
                value={filters.search}
                onChange={(event) => onFilterChange('search', event.target.value)}
                placeholder='Title or description'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='services-filter-type'>Type</Label>
              <Select
                id='services-filter-type'
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
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='services-filter-status'>Status</Label>
              <Select
                id='services-filter-status'
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
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[800px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Title</th>
              <th className='px-4 py-3 font-semibold'>Type</th>
              <th className='px-4 py-3 font-semibold'>Price</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Delivery</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {services.map((service) => (
              <tr
                key={service.id}
                className={`cursor-pointer transition ${
                  selectedServiceId === service.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => onSelectService(service.id)}
                onKeyDown={(event) => handleRowKeyDown(event, service.id)}
                tabIndex={0}
                role='row'
                aria-selected={selectedServiceId === service.id}
              >
                <td className='px-4 py-3'>{service.title}</td>
                <td className='px-4 py-3'>{formatEnumLabel(service.serviceType)}</td>
                <td className='px-4 py-3'>{formatServiceListPriceLabel(service)}</td>
                <td className='px-4 py-3'>{formatEnumLabel(service.status)}</td>
                <td className='px-4 py-3'>{formatEnumLabel(service.deliveryMode)}</td>
                <td className='px-4 py-3 text-right'>
                  <div className='flex justify-end gap-2'>
                    <CopyFeedbackIconButton
                      copied={duplicateDraftFeedbackId === service.id}
                      idleVariant='outline'
                      idleIcon={<DuplicateIcon className='h-4 w-4' />}
                      disabled={isMutating}
                      onClick={(event) => void handleDuplicateService(service, event)}
                      idleLabel='Duplicate service as new draft'
                      copiedLabel='Draft copy ready'
                      idleTitle='Duplicate service as new draft'
                      copiedTitle='Copied'
                    />
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      onClick={(event) => void handleDeleteService(service, event)}
                      disabled={isMutating || service.instancesCount > 0}
                      aria-label={
                        service.instancesCount > 0
                          ? 'Cannot delete service while it has instances'
                          : 'Delete service'
                      }
                      title={
                        service.instancesCount > 0
                          ? 'Remove all instances before deleting this service'
                          : 'Delete service'
                      }
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
