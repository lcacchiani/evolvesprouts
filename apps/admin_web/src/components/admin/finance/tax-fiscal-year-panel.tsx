'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { WarningTriangleIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { toErrorMessage } from '@/hooks/hook-errors';
import { listAllCustomerInvoices, type CustomerInvoiceSummary } from '@/lib/billing-api';
import { listAllAdminExpenses } from '@/lib/expenses-api';
import { enumerateFiscalYearStartYears, getFiscalYearRangeInclusive } from '@/lib/fiscal-year';
import { formatDateOnly, formatEnumLabel } from '@/lib/format';
import {
  buildTaxFiscalYearRows,
  defaultFiscalYearStartYear,
  taxFiscalYearRowsToCsv,
  type TaxFiscalYearRow,
} from '@/lib/tax-fiscal-year-report';
import type { Expense } from '@/types/expenses';

/** Earliest Hong Kong FY start year offered in the selector (April Y → March Y+1). */
const MIN_FISCAL_YEAR_START = 2024;

function isTaxDisplayedAsDash(tax: string | undefined): boolean {
  const t = tax?.trim() ?? '';
  if (t === '') {
    return true;
  }
  const n = Number.parseFloat(t.replace(/,/g, ''));
  return Number.isFinite(n) && n === 0;
}

export function TaxFiscalYearPanel() {
  const fySelectId = useId();
  const [fyStartYear, setFyStartYear] = useState(
    () => Math.max(MIN_FISCAL_YEAR_START, defaultFiscalYearStartYear()),
  );
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expensesPayload, setExpensesPayload] = useState<Expense[] | null>(null);
  const [issuedInvoicesPayload, setIssuedInvoicesPayload] = useState<CustomerInvoiceSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const [expenses, invoices] = await Promise.all([
          listAllAdminExpenses(),
          listAllCustomerInvoices({ status: 'issued' }),
        ]);
        if (!cancelled) {
          setExpensesPayload(expenses);
          setIssuedInvoicesPayload(invoices);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(toErrorMessage(error, 'Could not load tax fiscal-year data.'));
          setExpensesPayload([]);
          setIssuedInvoicesPayload([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<TaxFiscalYearRow[]>(() => {
    if (!expensesPayload || !issuedInvoicesPayload) {
      return [];
    }
    return buildTaxFiscalYearRows(expensesPayload, issuedInvoicesPayload, fyStartYear);
  }, [expensesPayload, issuedInvoicesPayload, fyStartYear]);

  const fyMeta = useMemo(() => getFiscalYearRangeInclusive(fyStartYear), [fyStartYear]);

  const fyYearOptions = useMemo(() => {
    const cur = defaultFiscalYearStartYear();
    const throughYear = Math.max(cur + 1, MIN_FISCAL_YEAR_START);
    return enumerateFiscalYearStartYears(MIN_FISCAL_YEAR_START, throughYear);
  }, []);

  const downloadCsv = useCallback(() => {
    const csv = taxFiscalYearRowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tax-fiscal-year-${fyStartYear}-${fyStartYear + 1}.csv`;
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [rows, fyStartYear]);

  const tableError = loadError;

  return (
    <PaginatedTableCard
      title='Tax'
      description={`Hong Kong fiscal year ${fyMeta.start} to ${fyMeta.end}. Expenses use invoice date when set; otherwise paid date. Revenue uses issued invoice totals by issue date.`}
      isLoading={isLoading}
      isLoadingMore={false}
      hasMore={false}
      error={tableError}
      loadingLabel='Loading expenses and invoices…'
      onLoadMore={() => {}}
      toolbar={
        <div className='mb-3 flex flex-wrap items-end gap-3'>
          <div className='min-w-[220px]'>
            <Label htmlFor={fySelectId}>Fiscal year</Label>
            <Select
              id={fySelectId}
              value={String(fyStartYear)}
              onChange={(event) => setFyStartYear(Number.parseInt(event.target.value, 10))}
              disabled={isLoading || Boolean(tableError)}
            >
              {fyYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} - {y + 1}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={() => downloadCsv()}
            disabled={isLoading || Boolean(tableError) || rows.length === 0}
          >
            Download CSV
          </Button>
        </div>
      }
    >
      <AdminDataTable tableClassName='min-w-[920px]'>
        <AdminDataTableHead>
          <tr>
            <th className='px-4 py-3 font-semibold'>Type</th>
            <th className='px-4 py-3 font-semibold'>Date</th>
            <th className='px-4 py-3 font-semibold'>Description</th>
            <th className='px-4 py-3 font-semibold'>Amount</th>
            <th className='px-4 py-3 font-semibold'>Tax</th>
            <th className='px-4 py-3 font-semibold'>Expense status</th>
          </tr>
        </AdminDataTableHead>
        <AdminDataTableBody>
          {!isLoading && !tableError && rows.length === 0 ? (
            <tr>
              <td className='px-4 py-6 text-slate-600' colSpan={6}>
                No expense or revenue rows in this fiscal year.
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={`${row.kind}:${row.referenceId}`}>
              <td className='px-4 py-3'>{row.kind === 'revenue' ? 'Revenue' : 'Expense'}</td>
              <td className='px-4 py-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span>{formatDateOnly(row.classificationDate)}</span>
                  {row.needsInvoiceDateWarning ? (
                    <span
                      className='inline-flex items-center gap-1 text-xs font-medium text-amber-700'
                      title='Vendor invoice date missing — classified using paid date'
                    >
                      <WarningTriangleIcon className='h-4 w-4 shrink-0 text-amber-600' aria-hidden />
                      Needs date
                    </span>
                  ) : null}
                </div>
              </td>
              <td className='px-4 py-3'>
                <p className='font-medium text-slate-900'>{row.description}</p>
              </td>
              <td className='px-4 py-3'>
                {!row.amount ? (
                  '—'
                ) : row.currency ? (
                  <span className='tabular-nums'>
                    {row.amount} {row.currency}
                  </span>
                ) : (
                  <span className='tabular-nums'>{row.amount}</span>
                )}
              </td>
              <td className='px-4 py-3'>
                {isTaxDisplayedAsDash(row.tax) ? (
                  '—'
                ) : row.currency ? (
                  <span className='tabular-nums'>
                    {row.tax} {row.currency}
                  </span>
                ) : (
                  <span className='tabular-nums'>{row.tax}</span>
                )}
              </td>
              <td className='px-4 py-3'>
                {row.kind === 'expense' && row.expenseStatus ? formatEnumLabel(row.expenseStatus) : '—'}
              </td>
            </tr>
          ))}
        </AdminDataTableBody>
      </AdminDataTable>
    </PaginatedTableCard>
  );
}
