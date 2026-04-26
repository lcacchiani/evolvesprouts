'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { useMemo } from 'react';

import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DeleteIcon, DuplicateIcon } from '@/components/icons/action-icons';
import { CopyFeedbackIconButton } from '@/components/ui/copy-feedback-icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useCopyFeedback } from '@/hooks/use-copy-feedback';
import {
  formatEnumLabel,
  formatInstanceSlotLocationSummary,
  formatInstanceTableTitle,
  formatSessionSlotStartsAtDisplay,
  orderSessionSlotsForDisplay,
} from '@/lib/format';

import type { LocationSummary, ServiceInstance, ServiceType } from '@/types/services';
import { SERVICE_TYPES } from '@/types/services';

export interface InstanceServiceFilterOption {
  id: string;
  title: string;
}

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
  /** Resolve true when the draft flow started (e.g. instance loaded); omit feedback on failure. */
  onDuplicateInstance: (instance: ServiceInstance) => Promise<boolean> | boolean | void;
  onDeleteInstance: (instanceId: string, serviceId: string) => Promise<void>;
  /** When set, show a service filter above the table (empty value = all services). */
  serviceFilter?: {
    value: string;
    options: InstanceServiceFilterOption[];
    onChange: (serviceId: string) => void;
  };
  /** When set, show a service type filter above the table (empty value = all types). */
  serviceTypeFilter?: {
    value: string;
    onChange: (serviceType: string) => void;
  };
  searchFilter?: {
    value: string;
    onChange: (value: string) => void;
  };
  /** When true, add cross-service columns (title with cohort, locations, slots) before status. */
  showServiceColumn?: boolean;
  /** Resolve location ids for the locations column (optional; ids shown when unknown). */
  locationOptions?: LocationSummary[];
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
  onDuplicateInstance,
  onDeleteInstance,
  serviceFilter,
  serviceTypeFilter,
  searchFilter,
  showServiceColumn = false,
  locationOptions = [],
}: InstanceListPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const { copiedKey: duplicateDraftFeedbackId, markCopied: markDuplicateDraftFeedback } = useCopyFeedback(1000);
  const locationById = useMemo(
    () => new Map(locationOptions.map((loc) => [loc.id, loc])),
    [locationOptions]
  );

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, instanceId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectInstance(instanceId);
    }
  };

  const handleDuplicateInstance = async (instance: ServiceInstance, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const started = await onDuplicateInstance(instance);
    if (started === true) {
      markDuplicateDraftFeedback(instance.id);
    }
  };

  const handleDeleteInstance = async (
    instance: ServiceInstance,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    const deleteLabel = formatInstanceTableTitle(instance);
    const confirmed = await requestConfirm({
      title: 'Delete instance',
      description: `Delete "${deleteLabel.trim() !== '' ? deleteLabel : 'this instance'}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDeleteInstance(instance.id, instance.serviceId);
  };

  return (
    <>
      <PaginatedTableCard
        title='Instances'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading instances...'
        onLoadMore={onLoadMore}
        toolbar={
          serviceFilter || serviceTypeFilter || searchFilter ? (
            <div className='mb-3 flex w-full min-w-0 flex-nowrap items-end gap-3'>
              {searchFilter ? (
                <div
                  className={
                    serviceTypeFilter || serviceFilter ? 'min-w-0 flex-[2]' : 'min-w-[220px] flex-1'
                  }
                >
                  <Label htmlFor='instances-filter-search'>Search instances</Label>
                  <Input
                    id='instances-filter-search'
                    value={searchFilter.value}
                    onChange={(event) => searchFilter.onChange(event.target.value)}
                    placeholder='Cohort, service, instructor, status'
                  />
                </div>
              ) : null}
              {serviceTypeFilter ? (
                <div className='min-w-0 flex-1'>
                  <Label htmlFor='instances-filter-service-type'>Type</Label>
                  <Select
                    id='instances-filter-service-type'
                    value={serviceTypeFilter.value}
                    onChange={(event) => serviceTypeFilter.onChange(event.target.value)}
                  >
                    <option value=''>All types</option>
                    {SERVICE_TYPES.map((serviceType) => (
                      <option key={serviceType} value={serviceType}>
                        {formatEnumLabel(serviceType)}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {serviceFilter ? (
                <div className='min-w-0 flex-1'>
                  <Label htmlFor='instances-filter-service'>Service</Label>
                  <Select
                    id='instances-filter-service'
                    value={serviceFilter.value}
                    onChange={(event) => serviceFilter.onChange(event.target.value)}
                  >
                    <option value=''>All services</option>
                    {serviceFilter.options.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <AdminDataTable tableClassName='min-w-[960px]'>
          <AdminDataTableHead>
            <tr>
              {showServiceColumn ? (
                <th className='px-4 py-3 font-semibold'>Title</th>
              ) : null}
              {showServiceColumn ? (
                <th className='px-4 py-3 font-semibold'>Locations</th>
              ) : null}
              {showServiceColumn ? (
                <th className='px-4 py-3 font-semibold'>Slots</th>
              ) : null}
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Capacity</th>
              <th className='px-4 py-3 font-semibold'>Instructor</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {instances.map((instance) => {
              const instanceTableTitle = formatInstanceTableTitle(instance);
              return (
                <tr
                  key={instance.id}
                  className={`cursor-pointer transition ${
                    selectedInstanceId === instance.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onSelectInstance(instance.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, instance.id)}
                  tabIndex={0}
                  role='row'
                  aria-selected={selectedInstanceId === instance.id}
                >
                  {showServiceColumn ? (
                    <td className='px-4 py-3'>
                      {instanceTableTitle.trim() !== '' ? instanceTableTitle : '\u00a0'}
                    </td>
                  ) : null}
                  {showServiceColumn ? (
                    <td className='max-w-[14rem] px-4 py-3 text-sm'>
                      {formatInstanceSlotLocationSummary(instance, locationById)}
                    </td>
                  ) : null}
                  {showServiceColumn ? (
                    <td className='px-4 py-3 align-top'>
                      {instance.sessionSlots.length === 0 ? (
                        '-'
                      ) : (
                        <ul className='m-0 max-w-[11rem] list-none space-y-0.5 p-0'>
                          {orderSessionSlotsForDisplay(instance.sessionSlots).map((slot, slotIndex) => (
                            <li key={slot.id ?? `${instance.id}-slot-${slotIndex}`}>
                              {formatSessionSlotStartsAtDisplay(slot.startsAt)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  ) : null}
                  <td className='px-4 py-3'>{formatEnumLabel(instance.status)}</td>
                  <td className='px-4 py-3'>{instance.maxCapacity ?? 'Unlimited'}</td>
                  <td className='px-4 py-3'>{instance.instructorId ?? '-'}</td>
                  <td className='px-4 py-3 text-right'>
                    <div className='flex justify-end gap-2'>
                      <CopyFeedbackIconButton
                        copied={duplicateDraftFeedbackId === instance.id}
                        idleVariant='outline'
                        idleIcon={<DuplicateIcon className='h-4 w-4' />}
                        disabled={isMutating}
                        onClick={(event) => void handleDuplicateInstance(instance, event)}
                        idleLabel='Duplicate instance as new row'
                        copiedLabel='Draft copy ready'
                        idleTitle='Duplicate instance as new row'
                        copiedTitle='Copied'
                      />
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
