'use client';

import type { KeyboardEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  isVoidingId: string | null;
  isMarkingPaidId: string | null;
  isReparsingId: string | null;
  onLoadMore: () => Promise<void> | void;
  onSelectExpense: (expenseId: string) => void;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: ExpenseStatus | '') => void;
  onParseStatusChange: (value: ExpenseParseStatus | '') => void;
  onReparse: (expenseId: string) => Promise<void> | void;
  onMarkPaid: (expenseId: string) => Promise<void> | void;
  onVoidExpense: (expenseId: string, reason: string) => Promise<void> | void;
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
  isVoidingId,
  isMarkingPaidId,
  isReparsingId,
  onLoadMore,
  onSelectExpense,
  onQueryChange,
  onStatusChange,
  onParseStatusChange,
  onReparse,
  onMarkPaid,
  onVoidExpense,
}: ExpensesListPanelProps) {
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidExpenseId, setVoidExpenseId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, expenseId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectExpense(expenseId);
    }
  };

  const openVoidDialog = (expenseId: string) => {
    setVoidExpenseId(expenseId);
    setVoidReason('');
    setVoidError('');
    setVoidDialogOpen(true);
  };

  const closeVoidDialog = () => {
    setVoidDialogOpen(false);
    setVoidExpenseId(null);
    setVoidReason('');
    setVoidError('');
  };

  const confirmVoid = async () => {
    if (!voidReason.trim()) {
      setVoidError('Reason is required.');
      return;
    }
    setVoidError('');
    if (!voidExpenseId) {
      return;
    }
    try {
      await onVoidExpense(voidExpenseId, voidReason.trim());
      closeVoidDialog();
    } catch (caught) {
      setVoidError(caught instanceof Error ? caught.message : 'Could not void this expense.');
    }
  };

  return (
    <>
      <PaginatedTableCard
        title='Submitted expenses'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading submitted expenses...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='expenses-query'>Search</Label>
              <Input
                id='expenses-query'
                placeholder='Vendor or invoice number'
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
            <div className='min-w-[140px]'>
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
            <div className='min-w-[160px]'>
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
        <AdminDataTable tableClassName='min-w-[720px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Vendor</th>
              <th className='px-4 py-3 font-semibold'>Total</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Created</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
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
                  <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                    <div className='flex flex-wrap justify-end gap-1'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isReparsingId === expense.id}
                        onClick={() => void onReparse(expense.id)}
                      >
                        {isReparsingId === expense.id ? '…' : 'Reparse'}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isMarkingPaidId === expense.id || expense.status === 'paid'}
                        onClick={() => void onMarkPaid(expense.id)}
                      >
                        {isMarkingPaidId === expense.id ? '…' : 'Paid'}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        disabled={isVoidingId === expense.id || expense.status === 'voided'}
                        onClick={() => openVoidDialog(expense.id)}
                      >
                        {isVoidingId === expense.id ? '…' : 'Void'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>

      <ConfirmDialog
        open={voidDialogOpen}
        title='Void expense'
        description='Provide a short reason. Voided expenses cannot be edited as submitted records.'
        confirmLabel='Void expense'
        cancelLabel='Cancel'
        variant='danger'
        confirmDisabled={Boolean(voidExpenseId && isVoidingId === voidExpenseId)}
        onCancel={closeVoidDialog}
        onConfirm={() => void confirmVoid()}
      >
        <div className='space-y-2'>
          <Label htmlFor='void-expense-reason'>Reason</Label>
          <Textarea
            id='void-expense-reason'
            value={voidReason}
            onChange={(event) => {
              setVoidReason(event.target.value);
              setVoidError('');
            }}
            rows={3}
            placeholder='Required'
          />
          {voidError ? <p className='text-sm text-red-600'>{voidError}</p> : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
