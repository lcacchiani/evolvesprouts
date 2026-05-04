'use client';

import type { FormEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEnrollmentParentPickers } from '@/hooks/use-enrollment-parent-pickers';
import { createDraftInvoice } from '@/lib/billing-api';

export const CUSTOMIZED_DRAFT_INVOICE_FORM_ID = 'client-billing-customized-draft-form';
const CUSTOMIZED_FORM_ID = CUSTOMIZED_DRAFT_INVOICE_FORM_ID;
const MAX_CUSTOMIZED_LINES = 50;

type CustomizedBillKind = 'contact' | 'family' | 'organization';

type CustomizedLineDraftRow = {
  id: string;
  description: string;
  quantity: string;
  unitAmount: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
};

function makeCustomizedLineRow(seq: number): CustomizedLineDraftRow {
  return {
    id: `custom-line-${seq}`,
    description: '',
    quantity: '1',
    unitAmount: '',
    discountAmount: '',
    taxRate: '',
    taxAmount: '',
  };
}

function currencySelectValue(
  code: string,
  options: readonly { value: string }[],
  fallback: string,
): string {
  const normalized = code.trim().toUpperCase() || fallback;
  return options.some((o) => o.value === normalized) ? normalized : fallback;
}

function parseAmountInput(raw: string): number | null {
  const t = raw.trim();
  if (t === '') {
    return null;
  }
  const n = Number.parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

export interface CustomizedDraftInvoiceCardProps {
  defaultCurrency: string;
  currencyOptions: readonly { value: string; label: string }[];
  editorBusy: boolean;
  /** When false, bill-to pickers are not loaded until the user switches to customized mode in the parent. */
  loadParents: boolean;
  onRequestBusy?: (busy: boolean) => void;
  onDraftError?: (message: string) => void;
  onValidityChange?: (valid: boolean) => void;
  onCreated: (invoiceId: string) => void | Promise<void>;
}

export function CustomizedDraftInvoiceCard({
  defaultCurrency,
  currencyOptions,
  editorBusy,
  loadParents,
  onRequestBusy,
  onDraftError,
  onValidityChange,
  onCreated,
}: CustomizedDraftInvoiceCardProps) {
  const customizedBillKindId = useId();
  const customizedBillEntitySelectId = useId();
  const customizedCurrencyId = useId();

  const {
    contactOptions,
    families,
    organizations,
    loading: customizedPickerLoading,
    error: customizedPickerError,
  } = useEnrollmentParentPickers(loadParents);

  const customizedLineIdSeq = useRef(1);

  const [customizedBillKind, setCustomizedBillKind] = useState<CustomizedBillKind>('contact');
  const [customizedBillEntityId, setCustomizedBillEntityId] = useState('');
  const [customizedCurrency, setCustomizedCurrency] = useState(() =>
    currencySelectValue(defaultCurrency, currencyOptions, defaultCurrency),
  );
  const [customizedLines, setCustomizedLines] = useState<CustomizedLineDraftRow[]>(() => [
    makeCustomizedLineRow(1),
  ]);

  useEffect(() => {
    setCustomizedBillEntityId('');
  }, [customizedBillKind]);

  const customizedBillEntityOptions = useMemo(() => {
    if (customizedBillKind === 'contact') {
      return contactOptions;
    }
    if (customizedBillKind === 'family') {
      return families;
    }
    return organizations;
  }, [contactOptions, customizedBillKind, families, organizations]);

  const customizedIssue = useMemo(() => {
    if (!loadParents || customizedPickerLoading) {
      return '';
    }
    if (customizedBillEntityId.trim() === '') {
      return 'Select a bill-to party.';
    }
    const allowed = new Set(customizedBillEntityOptions.map((o) => o.id));
    if (!allowed.has(customizedBillEntityId)) {
      return 'Selected party is not in the list; pick again.';
    }
    if (customizedLines.length === 0) {
      return 'Add at least one line.';
    }
    if (customizedLines.length > MAX_CUSTOMIZED_LINES) {
      return `At most ${MAX_CUSTOMIZED_LINES} lines are allowed.`;
    }
    for (let i = 0; i < customizedLines.length; i += 1) {
      const ln = customizedLines[i];
      if (ln.description.trim() === '') {
        return `Line ${i + 1}: description is required.`;
      }
      if (ln.description.trim().length > 500) {
        return `Line ${i + 1}: description must be at most 500 characters.`;
      }
      const qty = parseAmountInput(ln.quantity);
      if (qty === null || qty <= 0) {
        return `Line ${i + 1}: quantity must be a positive number.`;
      }
      const unit = parseAmountInput(ln.unitAmount);
      if (unit === null) {
        return `Line ${i + 1}: unit price must be a valid number.`;
      }
      const discRaw = ln.discountAmount.trim();
      if (discRaw !== '') {
        const disc = parseAmountInput(ln.discountAmount);
        if (disc === null || disc < 0) {
          return `Line ${i + 1}: discount must be a valid non-negative number.`;
        }
        if (disc > qty * unit + 1e-9) {
          return `Line ${i + 1}: discount cannot exceed quantity × unit price.`;
        }
      }
      const taxAmtRaw = ln.taxAmount.trim();
      const taxRateRaw = ln.taxRate.trim();
      if (taxAmtRaw !== '' && taxRateRaw !== '') {
        return `Line ${i + 1}: provide either tax amount or tax rate, not both.`;
      }
      if (taxAmtRaw !== '') {
        const ta = parseAmountInput(ln.taxAmount);
        if (ta === null || ta < 0) {
          return `Line ${i + 1}: tax amount must be a valid non-negative number.`;
        }
      }
      if (taxRateRaw !== '') {
        const tr = parseAmountInput(ln.taxRate);
        if (tr === null || tr < 0) {
          return `Line ${i + 1}: tax rate must be a valid non-negative number.`;
        }
      }
    }
    return '';
  }, [
    customizedBillEntityId,
    customizedBillEntityOptions,
    customizedLines,
    customizedPickerLoading,
    loadParents,
  ]);

  useEffect(() => {
    if (!loadParents) {
      onValidityChange?.(false);
      return;
    }
    const valid =
      !customizedPickerError &&
      !customizedPickerLoading &&
      customizedIssue === '';
    onValidityChange?.(valid);
  }, [
    customizedIssue,
    customizedPickerError,
    customizedPickerLoading,
    loadParents,
    onValidityChange,
  ]);

  const handleCreateCustomizedDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (customizedPickerError) {
      onDraftError?.(customizedPickerError);
      return;
    }
    if (customizedIssue) {
      onDraftError?.(customizedIssue);
      return;
    }
    onRequestBusy?.(true);
    try {
      const billTo =
        customizedBillKind === 'contact'
          ? { kind: 'contact' as const, contactId: customizedBillEntityId }
          : customizedBillKind === 'family'
            ? { kind: 'family' as const, familyId: customizedBillEntityId }
            : { kind: 'organization' as const, organizationId: customizedBillEntityId };
      const lines = customizedLines.map((ln) => {
        const row: {
          description: string;
          quantity: string;
          unitAmount: string;
          discountAmount?: string;
          taxRate?: string;
          taxAmount?: string;
        } = {
          description: ln.description.trim(),
          quantity: ln.quantity.trim(),
          unitAmount: ln.unitAmount.trim(),
        };
        if (ln.discountAmount.trim() !== '') {
          row.discountAmount = ln.discountAmount.trim();
        }
        if (ln.taxRate.trim() !== '') {
          row.taxRate = ln.taxRate.trim();
        }
        if (ln.taxAmount.trim() !== '') {
          row.taxAmount = ln.taxAmount.trim();
        }
        return row;
      });
      const result = await createDraftInvoice({
        draftKind: 'customized_manual',
        billTo,
        currency: customizedCurrency.trim().toUpperCase(),
        lines,
      });
      await onCreated(result.invoiceId);
      customizedLineIdSeq.current += 1;
      setCustomizedLines([makeCustomizedLineRow(customizedLineIdSeq.current)]);
    } catch (caught) {
      onDraftError?.(
        caught instanceof Error ? caught.message : 'Create draft failed.',
      );
    } finally {
      onRequestBusy?.(false);
    }
  };

  return (
    <div className='space-y-4'>
      <form id={CUSTOMIZED_FORM_ID} className='space-y-4' onSubmit={(e) => void handleCreateCustomizedDraft(e)}>
        {customizedPickerError ? (
          <p className='text-sm text-red-700' role='alert'>
            {customizedPickerError}
          </p>
        ) : null}
        <div className='flex flex-wrap gap-4'>
          <div className='min-w-[200px]'>
            <Label htmlFor={customizedBillKindId}>Bill to</Label>
            <Select
              id={customizedBillKindId}
              className='mt-1 w-full'
              value={customizedBillKind}
              onChange={(e) => setCustomizedBillKind(e.target.value as CustomizedBillKind)}
              disabled={editorBusy || customizedPickerLoading}
            >
              <option value='contact'>Contact</option>
              <option value='family'>Family</option>
              <option value='organization'>Organization</option>
            </Select>
          </div>
          <div className='min-w-[260px] flex-1'>
            <Label htmlFor={customizedBillEntitySelectId}>
              {customizedBillKind === 'contact'
                ? 'Contact'
                : customizedBillKind === 'family'
                  ? 'Family'
                  : 'Organization'}
            </Label>
            <Select
              id={customizedBillEntitySelectId}
              className='mt-1 w-full'
              value={customizedBillEntityId}
              onChange={(e) => setCustomizedBillEntityId(e.target.value)}
              disabled={editorBusy || customizedPickerLoading}
            >
              <option value=''>
                {customizedPickerLoading ? 'Loading parties…' : 'Select…'}
              </option>
              {customizedBillEntityOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className='min-w-[140px]'>
            <Label htmlFor={customizedCurrencyId}>Currency</Label>
            <Select
              id={customizedCurrencyId}
              className='mt-1 w-full'
              value={customizedCurrency}
              onChange={(e) => setCustomizedCurrency(e.target.value)}
              disabled={editorBusy}
            >
              {currencyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Button
            type='button'
            variant='secondary'
            disabled={editorBusy || customizedLines.length >= MAX_CUSTOMIZED_LINES}
            onClick={() => {
              customizedLineIdSeq.current += 1;
              setCustomizedLines((prev) => [...prev, makeCustomizedLineRow(customizedLineIdSeq.current)]);
            }}
          >
            Add line
          </Button>
        </div>
        <section aria-label='Custom invoice lines' className='space-y-3'>
          {customizedLines.map((ln, index) => (
            <div
              key={ln.id}
              className='flex flex-col gap-2 border border-slate-200 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end'
            >
              <div className='min-w-[200px] flex-1'>
                <Label htmlFor={`${CUSTOMIZED_FORM_ID}-desc-${ln.id}`}>Description</Label>
                <Textarea
                  id={`${CUSTOMIZED_FORM_ID}-desc-${ln.id}`}
                  className='mt-1 min-h-[4rem]'
                  value={ln.description}
                  onChange={(e) =>
                    setCustomizedLines((prev) =>
                      prev.map((row) =>
                        row.id === ln.id ? { ...row, description: e.target.value } : row,
                      ),
                    )
                  }
                  disabled={editorBusy}
                  rows={2}
                />
              </div>
              <div className='w-full sm:w-28'>
                <Label htmlFor={`${CUSTOMIZED_FORM_ID}-qty-${ln.id}`}>Quantity</Label>
                <Input
                  id={`${CUSTOMIZED_FORM_ID}-qty-${ln.id}`}
                  className='mt-1 font-mono tabular-nums'
                  inputMode='decimal'
                  value={ln.quantity}
                  onChange={(e) =>
                    setCustomizedLines((prev) =>
                      prev.map((row) =>
                        row.id === ln.id ? { ...row, quantity: e.target.value } : row,
                      ),
                    )
                  }
                  disabled={editorBusy}
                />
              </div>
              <div className='w-full sm:w-36'>
                <Label htmlFor={`${CUSTOMIZED_FORM_ID}-unit-${ln.id}`}>Unit price</Label>
                <Input
                  id={`${CUSTOMIZED_FORM_ID}-unit-${ln.id}`}
                  className='mt-1 font-mono tabular-nums'
                  inputMode='decimal'
                  value={ln.unitAmount}
                  onChange={(e) =>
                    setCustomizedLines((prev) =>
                      prev.map((row) =>
                        row.id === ln.id ? { ...row, unitAmount: e.target.value } : row,
                      ),
                    )
                  }
                  disabled={editorBusy}
                />
              </div>
              <div className='w-full sm:w-32'>
                <Label htmlFor={`${CUSTOMIZED_FORM_ID}-disc-${ln.id}`}>Discount</Label>
                <Input
                  id={`${CUSTOMIZED_FORM_ID}-disc-${ln.id}`}
                  className='mt-1 font-mono tabular-nums'
                  inputMode='decimal'
                  value={ln.discountAmount}
                  onChange={(e) =>
                    setCustomizedLines((prev) =>
                      prev.map((row) =>
                        row.id === ln.id ? { ...row, discountAmount: e.target.value } : row,
                      ),
                    )
                  }
                  disabled={editorBusy}
                  placeholder='0'
                />
              </div>
              <div className='w-full sm:w-28'>
                <Label htmlFor={`${CUSTOMIZED_FORM_ID}-tr-${ln.id}`}>Tax rate</Label>
                <Input
                  id={`${CUSTOMIZED_FORM_ID}-tr-${ln.id}`}
                  className='mt-1 font-mono tabular-nums'
                  inputMode='decimal'
                  value={ln.taxRate}
                  onChange={(e) =>
                    setCustomizedLines((prev) =>
                      prev.map((row) =>
                        row.id === ln.id ? { ...row, taxRate: e.target.value } : row,
                      ),
                    )
                  }
                  disabled={editorBusy}
                  placeholder='—'
                />
              </div>
              <div className='w-full sm:w-32'>
                <Label htmlFor={`${CUSTOMIZED_FORM_ID}-ta-${ln.id}`}>Tax amount</Label>
                <Input
                  id={`${CUSTOMIZED_FORM_ID}-ta-${ln.id}`}
                  className='mt-1 font-mono tabular-nums'
                  inputMode='decimal'
                  value={ln.taxAmount}
                  onChange={(e) =>
                    setCustomizedLines((prev) =>
                      prev.map((row) =>
                        row.id === ln.id ? { ...row, taxAmount: e.target.value } : row,
                      ),
                    )
                  }
                  disabled={editorBusy}
                  placeholder='—'
                />
              </div>
              <div className='flex items-end pb-1'>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={editorBusy || customizedLines.length <= 1}
                  onClick={() =>
                    setCustomizedLines((prev) => prev.filter((row) => row.id !== ln.id))
                  }
                >
                  Remove
                </Button>
              </div>
              <p className='w-full text-xs text-slate-600'>Line {index + 1}</p>
            </div>
          ))}
        </section>
        {customizedIssue && loadParents && !customizedPickerLoading ? (
          <p className='text-sm text-amber-800'>{customizedIssue}</p>
        ) : null}
      </form>
    </div>
  );
}
