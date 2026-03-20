'use client';

import type { KeyboardEvent } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatDate, formatEnumLabel } from '@/lib/format';
import {
  EXPENSE_PARSE_STATUSES,
  EXPENSE_STATUSES,
  type Expense,
  type ExpenseParseStatus,
  type ExpenseStatus,
} from '@/types/expenses';

interface ExpensesListPanelProps {
  expenses: Expense[];
  selectedExpenseId: string | null;
  query: string;
  status: ExpenseStatus | '';
  parseStatus: ExpenseParseStatus | '';
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  onLoadMore: () => Promise<void> | void;
  onSelectExpense: (expenseId: string) => void;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: ExpenseStatus | '') => void;
  onParseStatusChange: (value: ExpenseParseStatus | '') => void;
}

export function ExpensesListPanel({
  expenses,
  selectedExpenseId,
  query,
  status,
  parseStatus,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onSelectExpense,
  onQueryChange,
  onStatusChange,
  onParseStatusChange,
}: ExpensesListPanelProps) {
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, expenseId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectExpense(expenseId);
    }
  };

  return (
    <PaginatedTableCard
      title='Submitted Expenses'
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      loadingLabel='Loading submitted expenses...'
      onLoadMore={onLoadMore}
      toolbar={
        <div className='mb-3 grid grid-cols-1 gap-3 md:grid-cols-4'>
          <div className='md:col-span-2'>
            <Label htmlFor='expenses-query'>Search</Label>
            <Input
              id='expenses-query'
              placeholder='Vendor or invoice number'
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor='expenses-status'>Status</Label>
            <Select
              id='expenses-status'
              value={status}
              onChange={(event) => onStatusChange(event.target.value as ExpenseStatus | '')}
            >
              <option value=''>All</option>
              {EXPENSE_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='expenses-parse-status'>Parse status</Label>
            <Select
              id='expenses-parse-status'
              value={parseStatus}
              onChange={(event) => onParseStatusChange(event.target.value as ExpenseParseStatus | '')}
            >
              <option value=''>All</option>
              {EXPENSE_PARSE_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
    >
      <div className='rounded-md border border-slate-200'>
        <table className='w-full min-w-[560px] divide-y divide-slate-200 text-left'>
          <thead className='bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700'>
            <tr>
              <th className='px-4 py-3 font-semibold'>Vendor</th>
              <th className='px-4 py-3 font-semibold'>Total</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Created</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-200 bg-white text-sm'>
            {expenses.map((expense) => {
              const isSelected = expense.id === selectedExpenseId;
              return (
                <tr
                  key={expense.id}
                  className={`cursor-pointer transition hover:bg-slate-50 ${
                    isSelected ? 'bg-slate-100' : ''
                  }`}
                  onClick={() => onSelectExpense(expense.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, expense.id)}
                  tabIndex={0}
                  role='row'
                  aria-selected={isSelected}
                >
                  <td className='px-4 py-3'>
                    <p className='font-medium text-slate-900'>{expense.vendorName ?? '—'}</p>
                    <p className='mt-0.5 text-xs text-slate-500'>
                      {expense.invoiceNumber ?? expense.id.slice(0, 8)}
                    </p>
                  </td>
                  <td className='px-4 py-3'>
                    {expense.total ? `${expense.total} ${expense.currency ?? ''}` : '—'}
                  </td>
                  <td className='px-4 py-3'>{formatEnumLabel(expense.status)}</td>
                  <td className='px-4 py-3'>{formatDate(expense.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PaginatedTableCard>
  );
}
