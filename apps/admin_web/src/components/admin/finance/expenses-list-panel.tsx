'use client';

import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { OpenAdminAssetInNewTabButton } from '@/components/admin/shared/open-admin-asset-in-new-tab-button';
import { DeleteIcon, MarkPaidIcon, RotateIcon, VoidExpenseIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { AdminInlineError } from '@/components/ui/admin-inline-error';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toErrorMessage } from '@/hooks/hook-errors';
import { useOpenAdminAssetInNewTab } from '@/hooks/use-open-admin-asset-in-new-tab';
import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { primaryExpenseAttachmentAssetId } from '@/lib/expense-attachments';
import { formatDateOnly, formatEnumLabel } from '@/lib/format';
import { formatMoneyLineWithFxToDefault, loadFxMultipliersToAdminDefault } from '@/lib/vendor-spend';
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
  isDeletingDraftId: string | null;
  onLoadMore: () => Promise<void> | void;
  onSelectExpense: (expenseId: string) => void;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: ExpenseStatus | '') => void;
  onParseStatusChange: (value: ExpenseParseStatus | '') => void;
  onReparse: (expenseId: string) => Promise<void> | void;
  onMarkPaid: (expenseId: string) => Promise<void> | void;
  onVoidExpense: (expenseId: string, reason: string) => Promise<void> | void;
  onDeleteDraft: (expenseId: string) => Promise<void> | void;
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
  isDeletingDraftId,
  onLoadMore,
  onSelectExpense,
  onQueryChange,
  onStatusChange,
  onParseStatusChange,
  onReparse,
  onMarkPaid,
  onVoidExpense,
  onDeleteDraft,
}: ExpensesListPanelProps) {
  const { openingAssetId, openError: documentOpenError, openAssetInNewTab } = useOpenAdminAssetInNewTab();
  const [deleteDraftDialogOpen, setDeleteDraftDialogOpen] = useState(false);
  const [deleteDraftExpenseId, setDeleteDraftExpenseId] = useState<string | null>(null);
  const [deleteDraftError, setDeleteDraftError] = useState('');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidExpenseId, setVoidExpenseId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [fxMultipliers, setFxMultipliers] = useState<Map<string, number> | null>(null);
  const [fxError, setFxError] = useState('');

  const expensesNeedForeignFx = useMemo(() => {
    const defaultCurrency = getAdminDefaultCurrencyCode();
    return expenses.some(
      (expense) => (expense.currency?.trim().toUpperCase() || defaultCurrency) !== defaultCurrency,
    );
  }, [expenses]);

  useEffect(() => {
    if (!expensesNeedForeignFx) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setFxMultipliers(null);
      try {
        const codes = expenses
          .map((expense) => expense.currency?.trim().toUpperCase())
          .filter((code): code is string => Boolean(code));
        const map = await loadFxMultipliersToAdminDefault(codes);
        if (!cancelled) {
          setFxMultipliers(map);
          setFxError('');
        }
      } catch (err) {
        if (!cancelled) {
          setFxError(toErrorMessage(err, 'Could not load FX rates for currency conversion.'));
          setFxMultipliers(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expenses, expensesNeedForeignFx]);

  const tableError = [error, expensesNeedForeignFx ? fxError : ''].filter(Boolean).join(' ');

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

  const openDeleteDraftDialog = (expenseId: string) => {
    setDeleteDraftExpenseId(expenseId);
    setDeleteDraftError('');
    setDeleteDraftDialogOpen(true);
  };

  const closeDeleteDraftDialog = () => {
    setDeleteDraftDialogOpen(false);
    setDeleteDraftExpenseId(null);
    setDeleteDraftError('');
  };

  const confirmDeleteDraft = async () => {
    setDeleteDraftError('');
    if (!deleteDraftExpenseId) {
      return;
    }
    try {
      await onDeleteDraft(deleteDraftExpenseId);
      closeDeleteDraftDialog();
    } catch (caught) {
      setDeleteDraftError(caught instanceof Error ? caught.message : 'Could not delete this expense.');
    }
  };

  return (
    <>
      <PaginatedTableCard
        title='Submitted Expenses'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={tableError}
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
            {documentOpenError ? <AdminInlineError>{documentOpenError}</AdminInlineError> : null}
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
                    <span className='tabular-nums'>
                      {fxMultipliers === null && expensesNeedForeignFx
                        ? '…'
                        : formatMoneyLineWithFxToDefault(
                            expense.total?.trim() ?? '',
                            expense.currency ?? undefined,
                            expensesNeedForeignFx ? (fxMultipliers ?? new Map()) : new Map(),
                          )}
                    </span>
                  </td>
                  <td className='px-4 py-3'>{formatEnumLabel(expense.status)}</td>
                  <td className='px-4 py-3'>{formatDateOnly(expense.invoiceDate)}</td>
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
                        variant='success'
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
                            className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent'
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
                      {expense.status === 'draft' ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          disabled={isDeletingDraftId === expense.id}
                          onClick={() => openDeleteDraftDialog(expense.id)}
                          aria-label='Delete draft expense'
                          title='Delete draft expense'
                          aria-busy={isDeletingDraftId === expense.id}
                        >
                          {isDeletingDraftId === expense.id ? (
                            <span
                              className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent'
                              aria-hidden
                            />
                          ) : (
                            <DeleteIcon className='h-4 w-4' />
                          )}
                        </Button>
                      ) : null}
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
          {voidError ? <AdminInlineError>{voidError}</AdminInlineError> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteDraftDialogOpen}
        title='Delete draft expense'
        description='This permanently removes the draft from the list. You cannot undo this action.'
        confirmLabel='Delete expense'
        cancelLabel='Cancel'
        variant='danger'
        confirmDisabled={Boolean(deleteDraftExpenseId && isDeletingDraftId === deleteDraftExpenseId)}
        onCancel={closeDeleteDraftDialog}
        onConfirm={() => void confirmDeleteDraft()}
      >
        {deleteDraftError ? <AdminInlineError>{deleteDraftError}</AdminInlineError> : null}
      </ConfirmDialog>
    </>
  );
}
