'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { Select } from '@/components/ui/select';
import { DashboardCard } from '@/components/admin/dashboard/dashboard-card';
import { toErrorMessage } from '@/hooks/hook-errors';
import { useFxMultipliersForCurrencies } from '@/hooks/use-fx-multipliers-for-currencies';
import { listAllCustomerInvoices, type CustomerInvoiceSummary } from '@/lib/billing-api';
import { sumTaxFiscalYearKindInHkd } from '@/lib/dashboard-tax-position-sums';
import { listAllAdminExpenses } from '@/lib/expenses-api';
import { buildTaxFiscalYearRows } from '@/lib/tax-fiscal-year-report';
import { formatAmountInCurrency } from '@/lib/vendor-spend';
import type { Expense, ExpenseStatus } from '@/types/expenses';

const TAX_POSITION_EXPENSE_STATUS: ExpenseStatus = 'paid';

const FISCAL_YEAR_OPTIONS = [
  { label: '2025 - 2026', startYear: 2025 },
  { label: '2027 - 2027', startYear: 2027 },
] as const;

export function TaxPositionCard() {
  const selectId = useId();
  const [fyStartYear, setFyStartYear] = useState<number>(FISCAL_YEAR_OPTIONS[0].startYear);
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
          setLoadError(toErrorMessage(error, 'Could not load data.'));
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

  const rows = useMemo(() => {
    if (!expensesPayload || !issuedInvoicesPayload) {
      return [];
    }
    return buildTaxFiscalYearRows(
      expensesPayload,
      issuedInvoicesPayload,
      fyStartYear,
      TAX_POSITION_EXPENSE_STATUS,
    );
  }, [expensesPayload, issuedInvoicesPayload, fyStartYear]);

  const foreignFxCodes = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const c = row.currency?.trim().toUpperCase() || 'HKD';
      if (c !== 'HKD') {
        set.add(c);
      }
    }
    return Array.from(set);
  }, [rows]);

  const taxFxEnabled =
    foreignFxCodes.length > 0 && Boolean(expensesPayload && issuedInvoicesPayload && !isLoading);

  const { fxMultipliers, fxError } = useFxMultipliersForCurrencies(
    foreignFxCodes,
    taxFxEnabled,
    'Could not load FX rates for currency conversion.',
    'HKD',
  );

  const multipliersForSum = fxMultipliers ?? new Map<string, number>();
  const sumsReady = !taxFxEnabled || fxMultipliers !== null;

  const revenueHkd = sumsReady ? sumTaxFiscalYearKindInHkd(rows, 'revenue', multipliersForSum) : 0;
  const expenseHkd = sumsReady ? sumTaxFiscalYearKindInHkd(rows, 'expense', multipliersForSum) : 0;
  const netHkd = revenueHkd - expenseHkd;

  const tableError = [loadError, taxFxEnabled ? fxError : ''].filter(Boolean).join(' • ');

  return (
    <DashboardCard width='half'>
      <div className='space-y-4'>
        <h2 className='text-sm font-semibold text-slate-900'>Tax Position</h2>
        <Select
          id={selectId}
          aria-label='Fiscal year'
          value={String(fyStartYear)}
          onChange={(event) => {
            setFyStartYear(Number.parseInt(event.target.value, 10));
          }}
        >
          {FISCAL_YEAR_OPTIONS.map((opt) => (
            <option key={opt.startYear} value={opt.startYear}>
              {opt.label}
            </option>
          ))}
        </Select>
        {isLoading || !sumsReady ? (
          <div className='h-14 animate-pulse rounded-md bg-slate-100' aria-hidden />
        ) : tableError ? (
          <p className='text-sm text-red-600'>{tableError}</p>
        ) : (
          <div className='space-y-2 text-right text-sm tabular-nums'>
            <p className='font-medium text-slate-900'>{formatAmountInCurrency(revenueHkd, 'HKD')}</p>
            <p className='font-medium text-slate-900'>{formatAmountInCurrency(expenseHkd, 'HKD')}</p>
            <p
              className={
                netHkd >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'
              }
            >
              {formatAmountInCurrency(netHkd, 'HKD')}
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
