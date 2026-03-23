'use client';

import type { KeyboardEvent } from 'react';
import { useState } from 'react';

import { OpenAdminAssetInNewTabButton } from '@/components/admin/shared/open-admin-asset-in-new-tab-button';
import { MarkPaidIcon, RotateIcon, VoidExpenseIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOpenAdminAssetInNewTab } from '@/hooks/use-open-admin-asset-in-new-tab';
import { primaryExpenseAttachmentAssetId } from '@/lib/expense-attachments';
import { formatDate, formatEnumLabel } from '@/lib/format';
import {
  EXPENSE_PARSE_STATUSES,
  EXPENSE_STATUSES,
  type Expense,
  type ExpenseParseStatus,
  type ExpenseStatus,
} from '@/types/expenses';

function expenseHasRequiredFieldsForMarkPaid(expense: Expense): boolean {
  if (expense.vendorId == null || String(expense.vendorId).trim() === '') {
    return false;
  }
  if (expense.invoiceDate == null || String(expense.invoiceDate).trim() === '') {
    return false;
  }
  if (expense.currency == null || expense.currency.trim() === '') {
    return false;
  }
  if (expense.total == null || String(expense.total).trim() === '') {
    return false;
  }
  return true;
}

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
  const { openingAssetId, openError: documentOpenError, openAssetInNewTab } = useOpenAdminAssetInNewTab();
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
        title='Submitted Expenses'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading submitted expenses...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 space-y-2'>
            <div className='flex flex-wrap items-end gap-3'>
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
            {documentOpenError ? (
              <p className='text-sm text-red-600' role='alert'>
                {documentOpenError}
              </p>
            ) : null}
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[780px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Vendor</th>
              <th className='px-4 py-3 font-semibold'>Total</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Issued</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {expenses.map((expense) => {
              const isSelected = expense.id === selectedExpenseId;
              const documentAssetId = primaryExpenseAttachmentAssetId(expense.attachments);
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
                    {!expense.total ? (
                      '—'
                    ) : expense.currency ? (
                      <span className='tabular-nums'>
                        {expense.total} {expense.currency}
                      </span>
                    ) : (
                      <div>
                        <span className='tabular-nums'>{expense.total}</span>
                        <p className='mt-0.5 text-xs text-slate-500'>No currency code</p>
                      </div>
                    )}
                  </td>
                  <td className='px-4 py-3'>{formatEnumLabel(expense.status)}</td>
                  <td className='px-4 py-3'>
                    {expense.invoiceDate ? formatDate(expense.invoiceDate) : '—'}
                  </td>
                  <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                    <div className='flex flex-wrap justify-end gap-1'>
                      <OpenAdminAssetInNewTabButton
                        assetId={documentAssetId ?? ''}
                        isOpening={Boolean(documentAssetId && openingAssetId === documentAssetId)}
                        disabled={!documentAssetId}
                        title={
                          documentAssetId
                            ? 'Open invoice document in new tab'
                            : 'No attachment or email body for this expense'
                        }
                        ariaLabel={
                          documentAssetId
                            ? 'Open invoice document in new tab'
                            : 'No invoice document available'
                        }
                        onOpen={(assetId, event) => {
                          event.stopPropagation();
                          if (!assetId) {
                            return;
                          }
                          void openAssetInNewTab(assetId);
                        }}
                      />
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isReparsingId === expense.id}
                        onClick={() => void onReparse(expense.id)}
                        aria-label='Reparse expense'
                        title='Reparse expense'
                        aria-busy={isReparsingId === expense.id}
                      >
                        {isReparsingId === expense.id ? (
                          <span
                            className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-transparent'
                            aria-hidden
                          />
                        ) : (
                          <RotateIcon className='h-4 w-4' />
                        )}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={
                          isMarkingPaidId === expense.id ||
                          expense.status === 'paid' ||
                          !expenseHasRequiredFieldsForMarkPaid(expense)
                        }
                        onClick={() => void onMarkPaid(expense.id)}
                        aria-label='Mark expense as paid'
                        title={
                          expense.status === 'paid'
                            ? 'Already marked paid'
                            : expenseHasRequiredFieldsForMarkPaid(expense)
                              ? 'Mark expense as paid'
                              : 'Vendor, invoice date, currency, and total are required before marking paid'
                        }
                        aria-busy={isMarkingPaidId === expense.id}
                      >
                        {isMarkingPaidId === expense.id ? (
                          <span
                            className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-transparent'
                            aria-hidden
                          />
                        ) : (
                          <MarkPaidIcon className='h-4 w-4' />
                        )}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        disabled={isVoidingId === expense.id || expense.status === 'voided'}
                        onClick={() => openVoidDialog(expense.id)}
                        aria-label='Void'
                        title='Void expense'
                        aria-busy={isVoidingId === expense.id}
                      >
                        {isVoidingId === expense.id ? (
                          <span
                            className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent'
                            aria-hidden
                          />
                        ) : (
                          <VoidExpenseIcon className='h-4 w-4' />
                        )}
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
