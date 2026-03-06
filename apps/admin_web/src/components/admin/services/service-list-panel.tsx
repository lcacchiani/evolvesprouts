'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { formatDate, formatEnumLabel } from '@/lib/format';

import { SERVICE_STATUSES, SERVICE_TYPES } from '@/types/services';
import type { ServiceListFilters, ServiceSummary } from '@/types/services';

export interface ServiceListPanelProps {
  services: ServiceSummary[];
  selectedServiceId: string | null;
  filters: ServiceListFilters;
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  onSelectService: (serviceId: string) => void;
  onFilterChange: <TKey extends keyof ServiceListFilters>(
    key: TKey,
    value: ServiceListFilters[TKey]
  ) => void;
  onClearFilters: () => void;
  onLoadMore: () => Promise<void> | void;
}

export function ServiceListPanel({
  services,
  selectedServiceId,
  filters,
  totalCount,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onSelectService,
  onFilterChange,
  onClearFilters,
  onLoadMore,
}: ServiceListPanelProps) {
  return (
    <PaginatedTableCard
      title={`Services (${totalCount})`}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      loadingLabel='Loading services...'
      onLoadMore={onLoadMore}
      toolbar={
        <div className='mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4'>
          <Select
            value={filters.serviceType}
            onChange={(event) => onFilterChange('serviceType', event.target.value as ServiceListFilters['serviceType'])}
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
          <Button type='button' variant='ghost' onClick={onClearFilters}>
            Clear
          </Button>
        </div>
      }
    >
      <table className='w-full min-w-[720px] text-left text-sm'>
        <thead className='text-slate-500'>
          <tr>
            <th className='py-2 pr-3 font-medium'>Title</th>
            <th className='py-2 pr-3 font-medium'>Type</th>
            <th className='py-2 pr-3 font-medium'>Status</th>
            <th className='py-2 pr-3 font-medium'>Delivery</th>
            <th className='py-2 pr-3 font-medium'>Created</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr
              key={service.id}
              className={`cursor-pointer border-t ${selectedServiceId === service.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              onClick={() => onSelectService(service.id)}
            >
              <td className='py-2 pr-3'>{service.title}</td>
              <td className='py-2 pr-3'>{formatEnumLabel(service.serviceType)}</td>
              <td className='py-2 pr-3'>{formatEnumLabel(service.status)}</td>
              <td className='py-2 pr-3'>{formatEnumLabel(service.deliveryMode)}</td>
              <td className='py-2 pr-3'>{formatDate(service.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PaginatedTableCard>
  );
}
