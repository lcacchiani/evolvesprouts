'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuditLogDetailDialog } from '@/components/admin/finance/audit-log-detail-dialog';
import { ActionBadge } from '@/components/admin/finance/audit-log-badges';
import { ViewIcon } from '@/components/icons/action-icons';
import { StatusBanner } from '@/components/status-banner';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { AdminApiError } from '@/lib/api-admin-client';
import { listAuditLogs, type AuditLogsFilters } from '@/lib/audit-logs-api';
import { formatDate } from '@/lib/format';
import { listAdminUsers, listInstructorUsers } from '@/lib/users-api';

import type { AuditLog } from '@/types/audit-log';

export interface AuditLogsPanelProps {
  auditableTables: readonly string[];
}

type ActionFilter = 'all' | 'INSERT' | 'UPDATE' | 'DELETE';

const TIME_RANGES = [
  { value: '', label: 'All time' },
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
] as const;

function getTimestamp(range: string): string | undefined {
  if (!range) {
    return undefined;
  }
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

function formatGmtOffset(date: Date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const minuteSuffix = minutes ? `:${minutes.toString().padStart(2, '0')}` : '';
  return `GMT${sign}${hours}${minuteSuffix}`;
}

export function AuditLogsPanel({ auditableTables }: AuditLogsPanelProps) {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [userLookupError, setUserLookupError] = useState('');
  const [userEmailById, setUserEmailById] = useState<Record<string, string>>({});
  const userLookupPromise = useRef<Promise<Record<string, string>> | null>(null);
  const userLookupRef = useRef<Record<string, string>>({});
  const isMountedRef = useRef(true);

  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [userEmailFilter, setUserEmailFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  const loadUserDirectory = useCallback(async (showError = false) => {
    if (Object.keys(userLookupRef.current).length > 0) {
      return userLookupRef.current;
    }
    if (userLookupPromise.current) {
      return userLookupPromise.current;
    }

    userLookupPromise.current = (async () => {
      const emailById: Record<string, string> = {};
      try {
        const [admins, instructors] = await Promise.all([
          listAdminUsers(),
          listInstructorUsers(),
        ]);
        for (const batch of [admins.items, instructors.items]) {
          for (const user of batch) {
            if (!user.email) {
              continue;
            }
            emailById[user.sub] = user.email;
          }
        }
        userLookupRef.current = emailById;
        if (isMountedRef.current) {
          setUserEmailById(emailById);
        }
        return emailById;
      } catch (err) {
        if (showError && isMountedRef.current) {
          setUserLookupError(
            err instanceof AdminApiError ? err.message : 'Failed to load user directory.'
          );
        }
        return {};
      } finally {
        userLookupPromise.current = null;
      }
    })();

    return userLookupPromise.current;
  }, []);

  const buildFilters = useCallback(async (): Promise<AuditLogsFilters> => {
    const filters: AuditLogsFilters = {};
    if (actionFilter !== 'all') {
      filters.action = actionFilter;
    }
    if (tableFilter !== 'all') {
      filters.table = tableFilter;
    }
    if (userEmailFilter.trim()) {
      const email = userEmailFilter.trim().toLowerCase();
      const directory = await loadUserDirectory(true);
      const matchSub = Object.keys(directory).find(
        (sub) => directory[sub]?.trim().toLowerCase() === email
      );
      if (matchSub) {
        filters.user_id = matchSub;
      } else {
        filters.user_id = '__no_match__';
      }
    }
    if (recordIdFilter.trim()) {
      filters.record_id = recordIdFilter.trim();
    }
    const since = getTimestamp(timeRange);
    if (since) {
      filters.since = since;
    }
    return filters;
  }, [actionFilter, tableFilter, userEmailFilter, recordIdFilter, timeRange, loadUserDirectory]);

  const loadItems = useCallback(
    async (cursor?: string, reset = false) => {
      if (reset || !cursor) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError('');
      setUserLookupError('');
      try {
        const filters = await buildFilters();
        const response = await listAuditLogs(filters, cursor, 50);
        setItems((prev) =>
          reset || !cursor ? response.items : [...prev, ...response.items]
        );
        setNextCursor(response.next_cursor ?? null);
      } catch (err) {
        const message =
          err instanceof AdminApiError ? err.message : 'Failed to load audit logs.';
        setError(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [buildFilters]
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadUserDirectory(false);
  }, [loadUserDirectory]);

  useEffect(() => {
    void loadItems(undefined, true);
  }, [loadItems]);

  const handleApplyFilters = () => {
    void loadItems(undefined, true);
  };

  const handleClearFilters = () => {
    setActionFilter('all');
    setTableFilter('all');
    setUserEmailFilter('');
    setRecordIdFilter('');
    setTimeRange('24h');
  };

  const timestampHeader = useMemo(() => `Timestamp (${formatGmtOffset()})`, []);

  const getUserEmail = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) {
        return '—';
      }
      return userEmailById[userId] || '—';
    },
    [userEmailById]
  );

  return (
    <div className='space-y-6'>
      <PaginatedTableCard
        title='Audit logs'
        description='Database change history for audited tables (assets, grants, manual blocks).'
        isLoading={isLoading && items.length === 0}
        isLoadingMore={isLoadingMore}
        hasMore={Boolean(nextCursor)}
        error={error}
        loadingLabel='Loading audit logs...'
        onLoadMore={() => loadItems(nextCursor ?? undefined, false)}
        toolbar={
          <div className='mb-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4'>
            {userLookupError ? (
              <div className='mb-2'>
                <StatusBanner variant='error' title='User lookup'>
                  {userLookupError}
                </StatusBanner>
              </div>
            ) : null}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <div>
                <Label htmlFor='audit-action-filter'>Action</Label>
                <Select
                  id='audit-action-filter'
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
                >
                  <option value='all'>All actions</option>
                  <option value='INSERT'>Insert</option>
                  <option value='UPDATE'>Update</option>
                  <option value='DELETE'>Delete</option>
                </Select>
              </div>
              <div>
                <Label htmlFor='audit-table-filter'>Table</Label>
                <Select
                  id='audit-table-filter'
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                >
                  <option value='all'>All tables</option>
                  {auditableTables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor='audit-time-range'>Time range</Label>
                <Select
                  id='audit-time-range'
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  {TIME_RANGES.map((range) => (
                    <option key={range.value || 'all'} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor='audit-user-email-filter'>User email</Label>
                <Input
                  id='audit-user-email-filter'
                  type='text'
                  autoComplete='off'
                  placeholder='Filter by directory email…'
                  value={userEmailFilter}
                  onChange={(e) => setUserEmailFilter(e.target.value)}
                />
              </div>
            </div>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <div className='lg:col-span-2'>
                <Label htmlFor='audit-record-filter'>Record ID</Label>
                <Input
                  id='audit-record-filter'
                  type='text'
                  autoComplete='off'
                  placeholder='Filter by record ID…'
                  value={recordIdFilter}
                  onChange={(e) => setRecordIdFilter(e.target.value)}
                />
              </div>
              <div className='flex items-end gap-2 lg:col-span-2'>
                <Button
                  type='button'
                  variant='primary'
                  onClick={handleApplyFilters}
                  className='flex-1 sm:flex-initial'
                >
                  Apply filters
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handleClearFilters}
                  className='flex-1 sm:flex-initial'
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        }
      >
        {items.length === 0 && !isLoading ? (
          <p className='text-sm text-slate-600'>No audit logs match the current filters.</p>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <tr>
                  <th className='px-4 py-3' scope='col'>
                    {timestampHeader}
                  </th>
                  <th className='px-4 py-3' scope='col'>
                    Table
                  </th>
                  <th className='px-4 py-3' scope='col'>
                    Action
                  </th>
                  <th className='px-4 py-3' scope='col'>
                    User email
                  </th>
                  <th className='hidden px-4 py-3 md:table-cell' scope='col'>
                    Changed fields
                  </th>
                  <th className='px-4 py-3 text-right' scope='col'>
                    Operations
                  </th>
                </tr>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {items.map((item) => (
                  <tr key={item.id} className='hover:bg-slate-50'>
                    <td className='px-4 py-3 text-slate-600'>{formatDate(item.timestamp)}</td>
                    <td className='px-4 py-3 font-medium text-slate-900'>{item.table_name}</td>
                    <td className='px-4 py-3'>
                      <ActionBadge action={item.action} />
                    </td>
                    <td className='px-4 py-3 font-mono text-xs text-slate-600'>
                      {getUserEmail(item.user_id)}
                    </td>
                    <td className='hidden px-4 py-3 text-slate-500 md:table-cell'>
                      {item.changed_fields?.length ? item.changed_fields.join(', ') : '—'}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        onClick={() => setSelectedLog(item)}
                        aria-label='View details'
                      >
                        <ViewIcon className='h-4 w-4' />
                      </Button>
                    </td>
                  </tr>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <p className='mt-2 text-xs text-slate-500'>Showing {items.length} entries</p>
          </>
        )}
      </PaginatedTableCard>

      {selectedLog ? (
        <AuditLogDetailDialog
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          userEmailById={userEmailById}
        />
      ) : null}
    </div>
  );
}
