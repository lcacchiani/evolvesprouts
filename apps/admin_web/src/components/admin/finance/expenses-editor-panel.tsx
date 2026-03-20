'use client';

import { useMemo, useState } from 'react';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel, getCurrencyOptions } from '@/lib/format';
import { EXPENSE_STATUSES, type Expense, type ExpenseLineItem, type ExpenseStatus } from '@/types/expenses';

interface ExpensesEditorPanelProps {
  selectedExpense: Expense | null;
  isSaving: boolean;
  isUploadingFiles: boolean;
  isDeletingCurrentExpense: boolean;
  isMarkingCurrentExpensePaid: boolean;
  isReparsingCurrentExpense: boolean;
  mutationError: string;
  onCreate: (payload: {
    input: {
      status: ExpenseStatus;
      vendorName: string | null;
      invoiceNumber: string | null;
      invoiceDate: string | null;
      dueDate: string | null;
      currency: string | null;
      subtotal: string | null;
      tax: string | null;
      total: string | null;
      notes: string | null;
      lineItems: ExpenseLineItem[];
      parseRequested: boolean;
    };
    files: File[];
  }) => Promise<void>;
  onUpdate: (payload: {
    expenseId: string;
    input: {
      status: ExpenseStatus;
      vendorName: string | null;
      invoiceNumber: string | null;
      invoiceDate: string | null;
      dueDate: string | null;
      currency: string | null;
      subtotal: string | null;
      tax: string | null;
      total: string | null;
      notes: string | null;
      lineItems: ExpenseLineItem[];
      parseRequested: boolean;
    };
    newFiles: File[];
    existingAttachmentAssetIds: string[];
  }) => Promise<void>;
  onAmend: (payload: {
    expenseId: string;
    input: {
      status: ExpenseStatus;
      vendorName: string | null;
      invoiceNumber: string | null;
      invoiceDate: string | null;
      dueDate: string | null;
      currency: string | null;
      subtotal: string | null;
      tax: string | null;
      total: string | null;
      notes: string | null;
      lineItems: ExpenseLineItem[];
      parseRequested: boolean;
    };
    newFiles: File[];
    existingAttachmentAssetIds: string[];
  }) => Promise<void>;
  onCancelExpense: (expenseId: string, reason: string) => Promise<void>;
  onMarkPaid: (expenseId: string) => Promise<void>;
  onReparse: (expenseId: string) => Promise<void>;
  onStartCreate: () => void;
}

function toLineItemsJson(value: ExpenseLineItem[]): string {
  return JSON.stringify(
    value.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: item.amount,
    })),
    null,
    2
  );
}

function lineItemDecimalFromJson(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function parseLineItemsJson(value: string): ExpenseLineItem[] {
  if (!value.trim()) {
    return [];
  }
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Line items must be a JSON array.');
  }
  return parsed.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each line item must be an object.');
    }
    const record = entry as Record<string, unknown>;
    return {
      description: typeof record.description === 'string' ? record.description : null,
      quantity: lineItemDecimalFromJson(record.quantity),
      unitPrice: lineItemDecimalFromJson(record.unit_price),
      amount: lineItemDecimalFromJson(record.amount),
    };
  });
}

export function ExpensesEditorPanel({
  selectedExpense,
  isSaving,
  isUploadingFiles,
  isDeletingCurrentExpense,
  isMarkingCurrentExpensePaid,
  isReparsingCurrentExpense,
  mutationError,
  onCreate,
  onUpdate,
  onAmend,
  onCancelExpense,
  onMarkPaid,
  onReparse,
  onStartCreate,
}: ExpensesEditorPanelProps) {
  const currencyOptions = getCurrencyOptions();
  const [status, setStatus] = useState<ExpenseStatus>(selectedExpense?.status ?? 'submitted');
  const [vendorName, setVendorName] = useState(selectedExpense?.vendorName ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(selectedExpense?.invoiceNumber ?? '');
  const [invoiceDate, setInvoiceDate] = useState(selectedExpense?.invoiceDate ?? '');
  const [dueDate, setDueDate] = useState(selectedExpense?.dueDate ?? '');
  const [currency, setCurrency] = useState(selectedExpense?.currency ?? 'HKD');
  const [subtotal, setSubtotal] = useState(selectedExpense?.subtotal ?? '');
  const [tax, setTax] = useState(selectedExpense?.tax ?? '');
  const [total, setTotal] = useState(selectedExpense?.total ?? '');
  const [notes, setNotes] = useState(selectedExpense?.notes ?? '');
  const [lineItemsJson, setLineItemsJson] = useState(selectedExpense ? toLineItemsJson(selectedExpense.lineItems) : '[]');
  const [lineItemsError, setLineItemsError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [parseRequested, setParseRequested] = useState(!selectedExpense);
  const [carryExistingAttachments, setCarryExistingAttachments] = useState(true);

  const isEditMode = Boolean(selectedExpense);
  const isTerminal = selectedExpense
    ? selectedExpense.status === 'paid' || selectedExpense.status === 'voided' || selectedExpense.status === 'amended'
    : false;

  const selectedAttachmentAssetIds = useMemo(
    () => selectedExpense?.attachments.map((attachment) => attachment.assetId) ?? [],
    [selectedExpense]
  );

  async function handleSave() {
    let parsedLineItems: ExpenseLineItem[] = [];
    try {
      parsedLineItems = parseLineItemsJson(lineItemsJson);
      setLineItemsError('');
    } catch (error) {
      setLineItemsError(error instanceof Error ? error.message : 'Line items JSON is invalid.');
      return;
    }

    const payloadInput = {
      status,
      vendorName: vendorName.trim() || null,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceDate.trim() || null,
      dueDate: dueDate.trim() || null,
      currency: currency.trim() || null,
      subtotal: subtotal.trim() || null,
      tax: tax.trim() || null,
      total: total.trim() || null,
      notes: notes.trim() || null,
      lineItems: parsedLineItems,
      parseRequested,
    };

    try {
      if (!selectedExpense) {
        await onCreate({
          input: payloadInput,
          files,
        });
        return;
      }

      const existingAttachmentAssetIds = carryExistingAttachments ? selectedAttachmentAssetIds : [];
      if (isTerminal) {
        await onAmend({
          expenseId: selectedExpense.id,
          input: payloadInput,
          newFiles: files,
          existingAttachmentAssetIds,
        });
        return;
      }

      await onUpdate({
        expenseId: selectedExpense.id,
        input: payloadInput,
        newFiles: files,
        existingAttachmentAssetIds,
      });
    } catch {
      // Errors are handled by hook state for actionable user feedback.
    }
  }

  return (
    <Card
      title='Expenses'
      description='Upload invoice documents, verify parsed fields, and keep amendment history.'
      className='space-y-4'
    >
      {mutationError ? (
        <StatusBanner variant='error' title='Expense'>
          {mutationError}
        </StatusBanner>
      ) : null}
      {selectedExpense ? (
        <div className='rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700'>
          Parse status: {formatEnumLabel(selectedExpense.parseStatus)}
          {selectedExpense.parseConfidence ? ` (confidence ${selectedExpense.parseConfidence})` : ''}
        </div>
      ) : null}
      <div className='grid grid-cols-1 gap-3 md:grid-cols-3 [&>div]:min-w-0'>
        <div>
          <Label htmlFor='expense-status'>Status</Label>
          <Select id='expense-status' value={status} onChange={(event) => setStatus(event.target.value as ExpenseStatus)}>
            {EXPENSE_STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor='expense-vendor'>Vendor</Label>
          <Input id='expense-vendor' value={vendorName} onChange={(event) => setVendorName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor='expense-invoice-number'>Invoice number</Label>
          <Input id='expense-invoice-number' value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
        </div>
        <div>
          <Label htmlFor='expense-invoice-date'>Invoice date</Label>
          <Input
            id='expense-invoice-date'
            type='date'
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
            className='max-w-[10.5rem] sm:max-w-[11rem] md:max-w-none'
          />
        </div>
        <div>
          <Label htmlFor='expense-due-date'>Due date</Label>
          <Input
            id='expense-due-date'
            type='date'
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className='max-w-[10.5rem] sm:max-w-[11rem] md:max-w-none'
          />
        </div>
        <div>
          <Label htmlFor='expense-currency'>Currency</Label>
          <Select id='expense-currency' value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor='expense-subtotal'>Subtotal</Label>
          <Input id='expense-subtotal' value={subtotal} onChange={(event) => setSubtotal(event.target.value)} />
        </div>
        <div>
          <Label htmlFor='expense-tax'>Tax</Label>
          <Input id='expense-tax' value={tax} onChange={(event) => setTax(event.target.value)} />
        </div>
        <div>
          <Label htmlFor='expense-total'>Total</Label>
          <Input id='expense-total' value={total} onChange={(event) => setTotal(event.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor='expense-notes'>Notes</Label>
        <Textarea id='expense-notes' value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </div>
      <div>
        <Label htmlFor='expense-line-items'>Line items JSON</Label>
        <Textarea
          id='expense-line-items'
          value={lineItemsJson}
          onChange={(event) => setLineItemsJson(event.target.value)}
          rows={6}
        />
        {lineItemsError ? <p className='mt-1 text-sm text-red-600'>{lineItemsError}</p> : null}
      </div>
      <div className='space-y-2'>
        <Label htmlFor='expense-files'>Attachments (PDF, PNG, JPG, WEBP; max 15MB each)</Label>
        <FileUploadButton
          id='expense-files'
          accept='application/pdf,image/png,image/jpeg,image/webp'
          multiple
          selectedFileName={files.length > 0 ? `${files.length} file(s) selected` : null}
          emptyLabel='No files selected'
          buttonLabel='Choose files'
          onChange={(event) => {
            const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
            setFiles(selectedFiles);
          }}
        />
        {selectedExpense?.attachments.length ? (
          <p className='text-sm text-slate-600'>
            Existing attachments:{' '}
            {selectedExpense.attachments
              .map((attachment) => attachment.fileName ?? attachment.assetTitle ?? attachment.assetId)
              .join(', ')}
          </p>
        ) : null}
      </div>
      {isEditMode ? (
        <label className='flex items-center gap-2 text-sm text-slate-700'>
          <input
            type='checkbox'
            checked={carryExistingAttachments}
            onChange={(event) => setCarryExistingAttachments(event.target.checked)}
          />
          Include existing attachments
        </label>
      ) : null}
      <label className='flex items-center gap-2 text-sm text-slate-700'>
        <input type='checkbox' checked={parseRequested} onChange={(event) => setParseRequested(event.target.checked)} />
        Queue parse after save
      </label>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' onClick={() => void handleSave()} disabled={isSaving || isUploadingFiles}>
          {isSaving || isUploadingFiles
            ? 'Saving...'
            : isTerminal
              ? 'Create amendment'
              : selectedExpense
                ? 'Update expense'
                : 'Submit expense'}
        </Button>
        {selectedExpense ? (
          <Button type='button' variant='secondary' onClick={onStartCreate} disabled={isSaving || isUploadingFiles}>
            New expense
          </Button>
        ) : null}
        {selectedExpense ? (
          <Button
            type='button'
            variant='outline'
            onClick={() => void onReparse(selectedExpense.id)}
            disabled={isReparsingCurrentExpense}
          >
            {isReparsingCurrentExpense ? 'Queueing parse...' : 'Reparse'}
          </Button>
        ) : null}
        {selectedExpense ? (
          <Button
            type='button'
            variant='outline'
            onClick={() => void onMarkPaid(selectedExpense.id)}
            disabled={isMarkingCurrentExpensePaid || selectedExpense.status === 'paid'}
          >
            {isMarkingCurrentExpensePaid ? 'Marking paid...' : 'Mark paid'}
          </Button>
        ) : null}
        {selectedExpense ? (
          <Button
            type='button'
            variant='danger'
            onClick={() => {
              const reason = window.prompt('Void reason');
              if (!reason || !reason.trim()) {
                return;
              }
              void onCancelExpense(selectedExpense.id, reason);
            }}
            disabled={isDeletingCurrentExpense || selectedExpense.status === 'voided'}
          >
            {isDeletingCurrentExpense ? 'Voiding...' : 'Void'}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
