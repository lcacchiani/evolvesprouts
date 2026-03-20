'use client';

import type { KeyboardEvent, MouseEvent } from 'react';

import { MarkPaidIcon, VoidExpenseIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
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
  isDeletingExpenseId: string | null;
  isMarkingPaidExpenseId: string | null;
  onLoadMore: () => Promise<void> | void;
  onSelectExpense: (expenseId: string) => void;
  onMarkPaid: (expenseId: string) => Promise<void>;
  onCancelExpense: (expenseId: string, reason: string) => Promise<void>;
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
  isDeletingExpenseId,
  isMarkingPaidExpenseId,
  onLoadMore,
  onSelectExpense,
  onMarkPaid,
  onCancelExpense,
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

  const handleMarkPaid = (expenseId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void onMarkPaid(expenseId);
  };

  const handleVoid = (expenseId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const reason = window.prompt('Void reason');
    if (!reason || !reason.trim()) {
      return;
    }
    void onCancelExpense(expenseId, reason);
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
        <table className='w-full min-w-[720px] divide-y divide-slate-200 text-left'>
          <thead className='bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700'>
            <tr>
              <th className='px-4 py-3 font-semibold'>Vendor</th>
              <th className='px-4 py-3 font-semibold'>Total</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Created</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-200 bg-white text-sm'>
            {expenses.map((expense) => {
              const isSelected = expense.id === selectedExpenseId;
              const canMarkPaid = expense.status !== 'paid' && expense.status !== 'voided';
              const canVoid = expense.status !== 'voided';
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
                  <td className='px-4 py-3 text-right'>
                    <div className='flex justify-end gap-1'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={(event) => handleMarkPaid(expense.id, event)}
                        disabled={!canMarkPaid || isMarkingPaidExpenseId === expense.id}
                        title='Mark paid'
                        aria-label='Mark paid'
                      >
                        <MarkPaidIcon className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        onClick={(event) => handleVoid(expense.id, event)}
                        disabled={!canVoid || isDeletingExpenseId === expense.id}
                        title='Void expense'
                        aria-label='Void expense'
                      >
                        <VoidExpenseIcon className='h-4 w-4' />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PaginatedTableCard>
  );
}
