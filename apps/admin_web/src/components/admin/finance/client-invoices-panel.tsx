'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { AdminInlineError } from '@/components/ui/admin-inline-error';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  confirmCustomerPayment,
  createCustomerRefund,
  createDraftInvoice,
  createPaymentAllocation,
  emailInvoice,
  exportBillingCsv,
  getCustomerInvoice,
  getCustomerPayment,
  issueInvoice,
  listCustomerInvoices,
  listCustomerPayments,
  parseEnrollmentIdList,
  parseLineTotalsOverridesJson,
  voidInvoice,
  type CustomerInvoiceDetail,
  type CustomerInvoiceSummary,
  type CustomerPaymentDetail,
  type CustomerPaymentSummary,
} from '@/lib/billing-api';
import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { getCurrencyOptions } from '@/lib/format';

const DRAFT_FORM_ID = 'client-billing-draft-invoice-form';
const ALLOCATE_FORM_ID = 'client-billing-allocate-form';
const REFUND_FORM_ID = 'client-billing-refund-form';

function formatTruncatedId(id: string | undefined): string {
  if (!id) {
    return '—';
  }
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}

function currencySelectValue(
  code: string,
  options: readonly { value: string }[],
  fallback: string,
): string {
  const normalized = code.trim().toUpperCase() || fallback;
  return options.some((o) => o.value === normalized) ? normalized : fallback;
}

export function ClientInvoicesPanel() {
  const draftDescriptionId = useId();
  const currencyOptions = useMemo(() => getCurrencyOptions(), []);
  const defaultCurrency = useMemo(() => getAdminDefaultCurrencyCode(), []);

  const [payments, setPayments] = useState<CustomerPaymentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [invoices, setInvoices] = useState<CustomerInvoiceSummary[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(true);
  const [invoiceListLoadingMore, setInvoiceListLoadingMore] = useState(false);
  const [invoiceListError, setInvoiceListError] = useState('');
  const [invoiceListCursor, setInvoiceListCursor] = useState<string | null>(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'draft' | 'issued' | 'void' | ''>('');
  const [invoiceCurrencyFilter, setInvoiceCurrencyFilter] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<CustomerInvoiceDetail | null>(null);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [invoiceDetailError, setInvoiceDetailError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTargetId, setVoidInvoiceTargetId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailInvoiceTargetId, setEmailInvoiceTargetId] = useState<string | null>(null);
  const [emailDialogTo, setEmailDialogTo] = useState('');
  const [emailDialogError, setEmailDialogError] = useState('');

  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] = useState(false);
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [confirmPaymentExternalRef, setConfirmPaymentExternalRef] = useState('');
  const [confirmPaymentError, setConfirmPaymentError] = useState('');

  const [enrollmentIdsText, setEnrollmentIdsText] = useState('');
  const [draftCurrency, setDraftCurrency] = useState(defaultCurrency);
  const [lineTotalsJson, setLineTotalsJson] = useState('');

  const [invoiceIdInput, setInvoiceIdInput] = useState('');
  const [emailTo, setEmailTo] = useState('');

  const [allocateInvoiceId, setAllocateInvoiceId] = useState('');
  const [allocateLineId, setAllocateLineId] = useState('');
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocateCurrency, setAllocateCurrency] = useState(defaultCurrency);

  const [refundOriginalId, setRefundOriginalId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundCurrency, setRefundCurrency] = useState(defaultCurrency);
  const [refundMethod, setRefundMethod] = useState('');
  const [refundStripeId, setRefundStripeId] = useState('');

  const lastPaymentSeedIdRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerPaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadPayments = useCallback(async (signal?: AbortSignal) => {
    setListLoading(true);
    setListError('');
    try {
      const items = await listCustomerPayments(signal);
      setPayments(items);
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') {
        return;
      }
      const message = caught instanceof Error ? caught.message : 'Failed to load payments.';
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadPayments(ac.signal);
    return () => ac.abort();
  }, [loadPayments]);

  const loadInvoicesFirstPage = useCallback(async (signal?: AbortSignal) => {
    setInvoiceListLoading(true);
    setInvoiceListError('');
    setInvoiceListCursor(null);
    try {
      const { items, next_cursor } = await listCustomerInvoices(
        {
          status: invoiceStatusFilter === '' ? undefined : invoiceStatusFilter,
          currency: invoiceCurrencyFilter === '' ? undefined : invoiceCurrencyFilter,
          limit: 50,
        },
        signal,
      );
      setInvoices(items);
      setInvoiceListCursor(next_cursor);
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') {
        return;
      }
      const message = caught instanceof Error ? caught.message : 'Failed to load invoices.';
      setInvoiceListError(message);
      setInvoices([]);
    } finally {
      setInvoiceListLoading(false);
    }
  }, [invoiceCurrencyFilter, invoiceStatusFilter]);

  useEffect(() => {
    const ac = new AbortController();
    void loadInvoicesFirstPage(ac.signal);
    return () => ac.abort();
  }, [loadInvoicesFirstPage]);

  const loadMoreInvoices = useCallback(async () => {
    if (!invoiceListCursor) {
      return;
    }
    setInvoiceListLoadingMore(true);
    setInvoiceListError('');
    try {
      const { items, next_cursor } = await listCustomerInvoices({
        status: invoiceStatusFilter === '' ? undefined : invoiceStatusFilter,
        currency: invoiceCurrencyFilter === '' ? undefined : invoiceCurrencyFilter,
        cursor: invoiceListCursor,
        limit: 50,
      });
      setInvoices((prev) => [...prev, ...items]);
      setInvoiceListCursor(next_cursor);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load more invoices.';
      setInvoiceListError(message);
    } finally {
      setInvoiceListLoadingMore(false);
    }
  }, [invoiceListCursor, invoiceCurrencyFilter, invoiceStatusFilter]);

  const loadInvoiceDetail = useCallback(async (id: string, signal?: AbortSignal) => {
    setInvoiceDetailLoading(true);
    setInvoiceDetailError('');
    try {
      const inv = await getCustomerInvoice(id, signal);
      if (signal?.aborted) {
        return;
      }
      setInvoiceDetail(inv);
      setEmailTo((prev) => {
        if (prev.trim() !== '') {
          return prev;
        }
        return inv.billToEmail?.trim() ?? prev;
      });
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') {
        return;
      }
      const message = caught instanceof Error ? caught.message : 'Failed to load invoice.';
      setInvoiceDetailError(message);
      setInvoiceDetail(null);
    } finally {
      if (!signal?.aborted) {
        setInvoiceDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceDetail(null);
      setInvoiceDetailError('');
      return;
    }
    const ac = new AbortController();
    void loadInvoiceDetail(selectedInvoiceId, ac.signal);
    return () => ac.abort();
  }, [selectedInvoiceId, loadInvoiceDetail]);

  const loadDetail = useCallback(
    async (id: string, signal?: AbortSignal) => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const row = await getCustomerPayment(id, signal);
        if (signal?.aborted) {
          return;
        }
        setDetail(row);
        if (lastPaymentSeedIdRef.current !== id) {
          lastPaymentSeedIdRef.current = id;
          const cur = row.currency ?? defaultCurrency;
          setAllocateCurrency(currencySelectValue(cur, currencyOptions, defaultCurrency));
          setRefundOriginalId(row.id ?? '');
          setRefundCurrency(currencySelectValue(cur, currencyOptions, defaultCurrency));
        }
      } catch (caught) {
        if (caught instanceof Error && caught.name === 'AbortError') {
          return;
        }
        const message = caught instanceof Error ? caught.message : 'Failed to load payment.';
        setDetailError(message);
        setDetail(null);
      } finally {
        if (!signal?.aborted) {
          setDetailLoading(false);
        }
      }
    },
    [currencyOptions, defaultCurrency],
  );

  useEffect(() => {
    setActionMessage('');
    setActionError('');
  }, [selectedId, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError('');
      lastPaymentSeedIdRef.current = null;
      return;
    }
    const ac = new AbortController();
    void loadDetail(selectedId, ac.signal);
    return () => ac.abort();
  }, [selectedId, loadDetail]);

  const setBusy = (key: string | null) => {
    setBusyAction(key);
  };

  const openVoidInvoiceDialog = (invoiceId: string) => {
    setVoidInvoiceTargetId(invoiceId);
    setInvoiceIdInput(invoiceId);
    setVoidReason('');
    setVoidError('');
    setVoidDialogOpen(true);
  };

  const closeVoidInvoiceDialog = () => {
    setVoidDialogOpen(false);
    setVoidInvoiceTargetId(null);
    setVoidReason('');
    setVoidError('');
  };

  const confirmVoidInvoice = async () => {
    const id = voidInvoiceTargetId?.trim();
    if (!id) {
      return;
    }
    if (!voidReason.trim()) {
      setVoidError('Void reason is required.');
      return;
    }
    setVoidError('');
    setBusy('void');
    try {
      await voidInvoice(id, voidReason.trim());
      setActionMessage(`Invoice voided: ${id}`);
      closeVoidInvoiceDialog();
      await loadPayments();
      await loadInvoicesFirstPage();
      if (selectedInvoiceId === id) {
        const ac = new AbortController();
        await loadInvoiceDetail(id, ac.signal);
      }
    } catch (caught) {
      setVoidError(caught instanceof Error ? caught.message : 'Void failed.');
    } finally {
      setBusy(null);
    }
  };

  const openEmailInvoiceDialog = (invoiceId: string, suggested?: string | null) => {
    setEmailInvoiceTargetId(invoiceId);
    setEmailDialogTo(suggested?.trim() ?? emailTo.trim() ?? '');
    setEmailDialogError('');
    setEmailDialogOpen(true);
  };

  const closeEmailInvoiceDialog = () => {
    setEmailDialogOpen(false);
    setEmailInvoiceTargetId(null);
    setEmailDialogTo('');
    setEmailDialogError('');
  };

  const submitEmailInvoice = async () => {
    const id = emailInvoiceTargetId?.trim();
    if (!id) {
      return;
    }
    const to = emailDialogTo.trim();
    if (!to) {
      setEmailDialogError('Recipient email is required.');
      return;
    }
    setEmailDialogError('');
    setBusy('email');
    try {
      const out = await emailInvoice(id, to);
      setActionMessage(out.sent ? 'Email send accepted.' : 'Email was not confirmed sent.');
      closeEmailInvoiceDialog();
      await loadInvoicesFirstPage();
      if (selectedInvoiceId === id) {
        const ac = new AbortController();
        await loadInvoiceDetail(id, ac.signal);
      }
    } catch (caught) {
      setEmailDialogError(caught instanceof Error ? caught.message : 'Email failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleIssueRow = async (invoiceId: string) => {
    setActionError('');
    setActionMessage('');
    setBusy('issue');
    try {
      const out = await issueInvoice(invoiceId);
      setActionMessage(
        `Issued invoice ${out.invoiceNumber ?? out.invoiceId ?? invoiceId}` +
          (out.issuedPdfSha256 ? ` (SHA-256: ${out.issuedPdfSha256.slice(0, 16)}…)` : ''),
      );
      await loadInvoicesFirstPage();
      if (selectedInvoiceId === invoiceId) {
        const ac = new AbortController();
        await loadInvoiceDetail(invoiceId, ac.signal);
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Issue failed.');
    } finally {
      setBusy(null);
    }
  };

  const openConfirmPaymentDialog = (paymentId: string) => {
    setConfirmPaymentId(paymentId);
    setConfirmPaymentExternalRef('');
    setConfirmPaymentError('');
    setConfirmPaymentDialogOpen(true);
  };

  const closeConfirmPaymentDialog = () => {
    setConfirmPaymentDialogOpen(false);
    setConfirmPaymentId(null);
    setConfirmPaymentExternalRef('');
    setConfirmPaymentError('');
  };

  const submitConfirmPayment = async () => {
    if (!confirmPaymentId) {
      return;
    }
    setConfirmPaymentError('');
    setBusy('confirm');
    try {
      const ext = confirmPaymentExternalRef.trim();
      await confirmCustomerPayment(
        confirmPaymentId,
        ext === '' ? undefined : { externalReference: ext },
      );
      setActionMessage('Payment confirmed.');
      closeConfirmPaymentDialog();
      await loadPayments();
      if (selectedId === confirmPaymentId) {
        const ac = new AbortController();
        await loadDetail(confirmPaymentId, ac.signal);
      }
    } catch (caught) {
      setConfirmPaymentError(caught instanceof Error ? caught.message : 'Confirm failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleCreateDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    const ids = parseEnrollmentIdList(enrollmentIdsText);
    if (ids.length === 0) {
      setActionError('Enter at least one enrollment UUID.');
      return;
    }
    const parsed = parseLineTotalsOverridesJson(lineTotalsJson);
    if (!parsed.ok) {
      setActionError(parsed.error);
      return;
    }
    setBusy('draft');
    try {
      const body: Parameters<typeof createDraftInvoice>[0] = {
        enrollmentIds: ids,
        currency: draftCurrency.trim().toUpperCase() || defaultCurrency,
      };
      if (parsed.overrides) {
        body.lineTotalsByEnrollmentId = parsed.overrides;
      }
      const result = await createDraftInvoice(body);
      setInvoiceIdInput(result.invoiceId);
      setSelectedInvoiceId(result.invoiceId);
      setAllocateInvoiceId(result.invoiceId);
      setActionMessage(`Draft invoice created: ${result.invoiceId}`);
      await loadPayments();
      await loadInvoicesFirstPage();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Create draft failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleAllocate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    if (!selectedId) {
      setActionError('Select a payment row first.');
      return;
    }
    const invId = allocateInvoiceId.trim();
    if (!invId) {
      setActionError('Invoice id is required for allocation.');
      return;
    }
    const amt = allocateAmount.trim();
    if (!amt) {
      setActionError('Allocated amount is required.');
      return;
    }
    setBusy('allocate');
    try {
      const out = await createPaymentAllocation({
        paymentId: selectedId,
        invoiceId: invId,
        invoiceLineId: allocateLineId.trim() === '' ? null : allocateLineId.trim(),
        allocatedAmount: amt,
        currency: allocateCurrency.trim().toUpperCase() || defaultCurrency,
      });
      setActionMessage(`Allocation created: ${out.allocationId}`);
      await loadPayments();
      const ac = new AbortController();
      await loadDetail(selectedId, ac.signal);
      await loadInvoicesFirstPage();
      if (selectedInvoiceId === invId) {
        const ac2 = new AbortController();
        await loadInvoiceDetail(invId, ac2.signal);
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Allocation failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    const orig = refundOriginalId.trim();
    if (!orig) {
      setActionError('Original payment id is required.');
      return;
    }
    const amt = refundAmount.trim();
    if (!amt) {
      setActionError('Refund amount is required.');
      return;
    }
    setBusy('refund');
    try {
      await createCustomerRefund({
        direction: 'refund',
        originalPaymentId: orig,
        amount: amt,
        currency: refundCurrency.trim().toUpperCase() || defaultCurrency,
        method: refundMethod.trim() === '' ? undefined : refundMethod.trim(),
        stripeRefundId: refundStripeId.trim() === '' ? null : refundStripeId.trim(),
      });
      setActionMessage('Refund payment row recorded.');
      await loadPayments();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Refund failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setExportBusy(true);
    setActionError('');
    try {
      const csv = await exportBillingCsv('2');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage('Export downloaded (v2 CSV).');
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  };

  const editorBusy = busyAction !== null;

  return (
    <div className='space-y-6'>
      <h2 className='text-lg font-semibold text-slate-900'>Client Invoices</h2>

      {actionMessage ? (
        <StatusBanner variant='success' title='Billing'>
          {actionMessage}
        </StatusBanner>
      ) : null}
      {actionError ? (
        <StatusBanner variant='error' title='Billing'>
          {actionError}
        </StatusBanner>
      ) : null}

      <AdminEditorCard
        title='Create draft invoice from enrollments'
        description='Enrollments must share the same bill-to and currency. Optional JSON overrides default line totals (enrollment UUID keys, decimal string values).'
        actions={
          <Button type='submit' form={DRAFT_FORM_ID} disabled={editorBusy}>
            {busyAction === 'draft' ? 'Creating…' : 'Create draft invoice'}
          </Button>
        }
      >
        <p id={draftDescriptionId} className='text-xs text-slate-600'>
          Use enrollment UUIDs separated by commas or newlines.
        </p>
        <form
          id={DRAFT_FORM_ID}
          className='space-y-3'
          onSubmit={(e) => void handleCreateDraft(e)}
          aria-describedby={draftDescriptionId}
        >
          <div>
            <Label htmlFor='billing-enrollment-ids'>Enrollment UUIDs</Label>
            <Textarea
              id='billing-enrollment-ids'
              value={enrollmentIdsText}
              onChange={(e) => setEnrollmentIdsText(e.target.value)}
              rows={3}
              className='mt-1 font-mono text-xs'
              placeholder='Comma or newline separated UUIDs'
              disabled={editorBusy}
            />
          </div>
          <div>
            <Label htmlFor='billing-draft-currency'>Currency</Label>
            <Select
              id='billing-draft-currency'
              className='mt-1 max-w-xs'
              value={draftCurrency}
              onChange={(e) => setDraftCurrency(e.target.value)}
              disabled={editorBusy}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='billing-line-overrides'>Line totals override (JSON, optional)</Label>
            <Textarea
              id='billing-line-overrides'
              value={lineTotalsJson}
              onChange={(e) => setLineTotalsJson(e.target.value)}
              rows={2}
              className='mt-1 font-mono text-xs'
              placeholder='{"uuid-enrollment": "100.00"}'
              disabled={editorBusy}
            />
          </div>
        </form>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Customer invoices'
        description='Cursor-paginated invoices (newest first). Use Operations to issue, email, or void. Select a row to load lines and copy ids for allocation.'
        isLoading={invoiceListLoading}
        isLoadingMore={invoiceListLoadingMore}
        hasMore={Boolean(invoiceListCursor)}
        error={invoiceListError}
        onLoadMore={() => void loadMoreInvoices()}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-4'>
            <div>
              <Label htmlFor='billing-invoice-status-filter'>Status</Label>
              <Select
                id='billing-invoice-status-filter'
                className='mt-1 w-44'
                value={invoiceStatusFilter}
                onChange={(e) =>
                  setInvoiceStatusFilter(
                    e.target.value === '' ? '' : (e.target.value as 'draft' | 'issued' | 'void'),
                  )
                }
              >
                <option value=''>All</option>
                <option value='draft'>Draft</option>
                <option value='issued'>Issued</option>
                <option value='void'>Void</option>
              </Select>
            </div>
            <div>
              <Label htmlFor='billing-invoice-currency-filter'>Currency</Label>
              <Select
                id='billing-invoice-currency-filter'
                className='mt-1 w-44'
                value={invoiceCurrencyFilter}
                onChange={(e) => setInvoiceCurrencyFilter(e.target.value)}
              >
                <option value=''>All currencies</option>
                {currencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type='button'
              variant='outline'
              onClick={() => void loadInvoicesFirstPage()}
              disabled={invoiceListLoading}
            >
              Refresh invoices
            </Button>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[980px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-3 py-2'>Invoice</th>
              <th className='px-3 py-2'>Status</th>
              <th className='px-3 py-2'>Number</th>
              <th className='px-3 py-2'>Bill to</th>
              <th className='px-3 py-2'>Total</th>
              <th className='px-3 py-2'>Lines</th>
              <th className='px-3 py-2'>Created</th>
              <th className='px-3 py-2 text-right'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {invoices.map((inv, index) => {
              const id = inv.id ?? '';
              const selected = id && selectedInvoiceId === id;
              return (
                <tr
                  key={id || `invoice-row-${String(index)}`}
                  className={selected ? 'bg-sky-50' : undefined}
                >
                  <td className='px-3 py-2'>
                    <button
                      type='button'
                      className='font-mono text-left text-xs text-sky-800 underline decoration-sky-300 hover:decoration-sky-600'
                      onClick={() => {
                        setSelectedInvoiceId(id || null);
                        if (id) {
                          setInvoiceIdInput(id);
                          setAllocateInvoiceId(id);
                        }
                      }}
                    >
                      {formatTruncatedId(id)}
                    </button>
                  </td>
                  <td className='px-3 py-2'>{inv.status}</td>
                  <td className='px-3 py-2 text-xs'>{inv.invoiceNumber ?? '—'}</td>
                  <td className='px-3 py-2 text-xs text-slate-700'>
                    {inv.billToDisplayName ?? inv.billToEmail ?? '—'}
                  </td>
                  <td className='px-3 py-2'>
                    {inv.total} {inv.currency}
                  </td>
                  <td className='px-3 py-2'>{inv.lineCount ?? 0}</td>
                  <td className='px-3 py-2 text-xs text-slate-600'>{inv.createdAt?.slice(0, 19) ?? '—'}</td>
                  <td className='px-3 py-2 text-right'>
                    <div className='flex flex-wrap justify-end gap-1'>
                      {inv.status === 'draft' ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          disabled={editorBusy}
                          onClick={() => void handleIssueRow(id)}
                        >
                          {busyAction === 'issue' ? '…' : 'Issue'}
                        </Button>
                      ) : null}
                      {inv.status === 'issued' ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          disabled={editorBusy}
                          onClick={() => openEmailInvoiceDialog(id, inv.billToEmail)}
                        >
                          Email…
                        </Button>
                      ) : null}
                      {inv.status !== 'void' ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          disabled={editorBusy}
                          onClick={() => openVoidInvoiceDialog(id)}
                        >
                          Void…
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

      <Card
        title='Selected invoice'
        className='border-slate-200 bg-slate-50/80 p-3 shadow-none sm:p-4'
      >
        {!selectedInvoiceId ? (
          <p className='text-sm text-slate-600'>Select an invoice row above to load line items and UUIDs.</p>
        ) : invoiceDetailLoading ? (
          <p className='text-sm text-slate-600'>Loading invoice…</p>
        ) : invoiceDetailError ? (
          <AdminInlineError>{invoiceDetailError}</AdminInlineError>
        ) : invoiceDetail ? (
          <div className='space-y-4'>
            <div className='max-w-xl'>
              <Label htmlFor='billing-invoice-id'>Invoice UUID (edit or paste)</Label>
              <Input
                id='billing-invoice-id'
                value={invoiceIdInput}
                onChange={(e) => setInvoiceIdInput(e.target.value)}
                className='mt-1 font-mono text-sm'
                disabled={editorBusy}
              />
            </div>
            <div>
              <Label htmlFor='billing-email-to'>Default email for row “Email…” dialog</Label>
              <Input
                id='billing-email-to'
                type='email'
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className='mt-1 max-w-md'
                disabled={editorBusy}
              />
            </div>
            <dl className='grid gap-1 text-sm text-slate-700 sm:grid-cols-2'>
              <div>
                <dt className='text-xs uppercase text-slate-500'>Status</dt>
                <dd>{invoiceDetail.status}</dd>
              </div>
              <div>
                <dt className='text-xs uppercase text-slate-500'>Number</dt>
                <dd>{invoiceDetail.invoiceNumber ?? '—'}</dd>
              </div>
              <div>
                <dt className='text-xs uppercase text-slate-500'>Total</dt>
                <dd>
                  {invoiceDetail.total} {invoiceDetail.currency}
                </dd>
              </div>
              <div className='sm:col-span-2'>
                <dt className='text-xs uppercase text-slate-500'>Bill to</dt>
                <dd>{invoiceDetail.billToDisplayName ?? invoiceDetail.billToEmail ?? '—'}</dd>
              </div>
            </dl>
            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600'>Lines</p>
              <AdminDataTable tableClassName='min-w-[640px]'>
                <AdminDataTableHead>
                  <tr>
                    <th className='px-2 py-1.5'>Line id</th>
                    <th className='px-2 py-1.5'>Enrollment</th>
                    <th className='px-2 py-1.5'>Description</th>
                    <th className='px-2 py-1.5'>Total</th>
                  </tr>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {(invoiceDetail.lines ?? []).map((ln) => (
                    <tr key={ln.id}>
                      <td className='px-2 py-1.5'>
                        <button
                          type='button'
                          className='max-w-[140px] truncate font-mono text-left text-xs text-sky-800 underline decoration-sky-300 hover:decoration-sky-600'
                          title={ln.id}
                          onClick={() => {
                            if (ln.id) {
                              setAllocateLineId(ln.id);
                            }
                          }}
                        >
                          {formatTruncatedId(ln.id)}
                        </button>
                      </td>
                      <td className='px-2 py-1.5 font-mono text-xs'>{formatTruncatedId(ln.enrollmentId)}</td>
                      <td className='px-2 py-1.5 text-xs'>{ln.description}</td>
                      <td className='px-2 py-1.5 text-xs'>
                        {ln.lineTotal} {ln.currency}
                      </td>
                    </tr>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            </div>
          </div>
        ) : null}
      </Card>

      <AdminEditorCard
        title='Allocate selected payment to invoice'
        description='Select a payment in the table below first. Invoice and line UUIDs can come from the selected invoice panel.'
        actions={
          <Button type='submit' form={ALLOCATE_FORM_ID} disabled={editorBusy}>
            {busyAction === 'allocate' ? 'Allocating…' : 'Create allocation'}
          </Button>
        }
      >
        <form id={ALLOCATE_FORM_ID} className='grid max-w-2xl gap-3 sm:grid-cols-2' onSubmit={(e) => void handleAllocate(e)}>
          <div className='sm:col-span-2'>
            <Label htmlFor='billing-allocate-invoice'>Invoice UUID for allocation</Label>
            <Input
              id='billing-allocate-invoice'
              value={allocateInvoiceId}
              onChange={(e) => setAllocateInvoiceId(e.target.value)}
              className='mt-1 font-mono text-sm'
              disabled={editorBusy}
            />
          </div>
          <div className='sm:col-span-2'>
            <Label htmlFor='billing-allocate-line'>Invoice line UUID (optional)</Label>
            <Input
              id='billing-allocate-line'
              value={allocateLineId}
              onChange={(e) => setAllocateLineId(e.target.value)}
              className='mt-1 font-mono text-sm'
              disabled={editorBusy}
            />
          </div>
          <div>
            <Label htmlFor='billing-allocate-amount'>Amount</Label>
            <Input
              id='billing-allocate-amount'
              value={allocateAmount}
              onChange={(e) => setAllocateAmount(e.target.value)}
              className='mt-1'
              disabled={editorBusy}
            />
          </div>
          <div>
            <Label htmlFor='billing-allocate-currency'>Currency</Label>
            <Select
              id='billing-allocate-currency'
              className='mt-1 max-w-xs'
              value={allocateCurrency}
              onChange={(e) => setAllocateCurrency(e.target.value)}
              disabled={editorBusy}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </AdminEditorCard>

      <AdminEditorCard
        title='Record refund payment row'
        description='Creates a succeeded refund payment linked to the original payment.'
        actions={
          <Button type='submit' form={REFUND_FORM_ID} disabled={editorBusy} variant='secondary'>
            {busyAction === 'refund' ? 'Recording…' : 'Record refund'}
          </Button>
        }
      >
        <form id={REFUND_FORM_ID} className='grid max-w-2xl gap-3 sm:grid-cols-2' onSubmit={(e) => void handleRefund(e)}>
          <div className='sm:col-span-2'>
            <Label htmlFor='billing-refund-original'>Original payment UUID</Label>
            <Input
              id='billing-refund-original'
              value={refundOriginalId}
              onChange={(e) => setRefundOriginalId(e.target.value)}
              className='mt-1 font-mono text-sm'
              disabled={editorBusy}
            />
          </div>
          <div>
            <Label htmlFor='billing-refund-amount'>Amount</Label>
            <Input
              id='billing-refund-amount'
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className='mt-1'
              disabled={editorBusy}
            />
          </div>
          <div>
            <Label htmlFor='billing-refund-currency'>Currency</Label>
            <Select
              id='billing-refund-currency'
              className='mt-1 max-w-xs'
              value={refundCurrency}
              onChange={(e) => setRefundCurrency(e.target.value)}
              disabled={editorBusy}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='billing-refund-method'>Method (optional)</Label>
            <Input
              id='billing-refund-method'
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              className='mt-1'
              disabled={editorBusy}
            />
          </div>
          <div>
            <Label htmlFor='billing-refund-stripe'>Stripe refund id (optional)</Label>
            <Input
              id='billing-refund-stripe'
              value={refundStripeId}
              onChange={(e) => setRefundStripeId(e.target.value)}
              className='mt-1 font-mono text-sm'
              disabled={editorBusy}
            />
          </div>
        </form>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Customer payments'
        description='Recent customer payments and refunds. Select a row for allocation and refund source. Pending inbound: use Confirm in Operations.'
        isLoading={listLoading}
        isLoadingMore={false}
        hasMore={false}
        error={listError}
        onLoadMore={() => {}}
        toolbar={
          <div className='mb-3 flex flex-wrap gap-2'>
            <Button type='button' variant='outline' onClick={() => void loadPayments()} disabled={listLoading}>
              Refresh
            </Button>
            <Button type='button' variant='outline' onClick={() => void handleExport()} disabled={exportBusy}>
              {exportBusy ? 'Exporting…' : 'Download CSV export (v2)'}
            </Button>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[720px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-3 py-2'>Payment</th>
              <th className='px-3 py-2'>Direction</th>
              <th className='px-3 py-2'>Status</th>
              <th className='px-3 py-2'>Method</th>
              <th className='px-3 py-2'>Amount</th>
              <th className='px-3 py-2'>Created</th>
              <th className='px-3 py-2 text-right'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {payments.map((p, index) => {
              const id = p.id ?? '';
              const selected = id && selectedId === id;
              return (
                <tr
                  key={id || `payment-row-${String(index)}`}
                  className={selected ? 'bg-sky-50' : undefined}
                >
                  <td className='px-3 py-2'>
                    <button
                      type='button'
                      className='font-mono text-left text-xs text-sky-800 underline decoration-sky-300 hover:decoration-sky-600'
                      onClick={() => setSelectedId(id || null)}
                    >
                      {formatTruncatedId(id)}
                    </button>
                  </td>
                  <td className='px-3 py-2'>{p.direction}</td>
                  <td className='px-3 py-2'>{p.status}</td>
                  <td className='px-3 py-2'>{p.method ?? '—'}</td>
                  <td className='px-3 py-2'>
                    {p.amount} {p.currency}
                  </td>
                  <td className='px-3 py-2 text-xs text-slate-600'>{p.createdAt?.slice(0, 19) ?? '—'}</td>
                  <td className='px-3 py-2 text-right'>
                    {p.status === 'pending' && p.direction === 'inbound' ? (
                      <Button
                        type='button'
                        variant='secondary'
                        className='text-xs'
                        disabled={confirmPaymentDialogOpen || busyAction === 'confirm'}
                        onClick={() => openConfirmPaymentDialog(id)}
                      >
                        Confirm…
                      </Button>
                    ) : (
                      <span className='text-xs text-slate-400'>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>

      <Card
        title='Selected payment'
        className='border-slate-200 bg-slate-50/80 p-3 shadow-none sm:p-4'
      >
        {!selectedId ? (
          <p className='text-sm text-slate-600'>
            Select a row in the payments table to load unapplied balance and pre-fill allocation and refund fields.
          </p>
        ) : detailLoading ? (
          <p className='text-sm text-slate-600'>Loading payment…</p>
        ) : detailError ? (
          <AdminInlineError>{detailError}</AdminInlineError>
        ) : detail ? (
          <dl className='mt-1 grid gap-1 text-sm text-slate-700 sm:grid-cols-2'>
            <div>
              <dt className='text-xs uppercase text-slate-500'>Id</dt>
              <dd className='font-mono text-xs'>{detail.id}</dd>
            </div>
            <div>
              <dt className='text-xs uppercase text-slate-500'>Status</dt>
              <dd>{detail.status}</dd>
            </div>
            <div>
              <dt className='text-xs uppercase text-slate-500'>Direction</dt>
              <dd>{detail.direction}</dd>
            </div>
            <div>
              <dt className='text-xs uppercase text-slate-500'>Amount</dt>
              <dd>
                {detail.amount} {detail.currency}
              </dd>
            </div>
            <div>
              <dt className='text-xs uppercase text-slate-500'>Unapplied</dt>
              <dd>{detail.unappliedAmount ?? '—'}</dd>
            </div>
          </dl>
        ) : null}
      </Card>

      <ConfirmDialog
        open={voidDialogOpen}
        title='Void invoice'
        description='This voids the draft or issued invoice. Provide a short reason for the audit trail.'
        confirmLabel='Void invoice'
        cancelLabel='Cancel'
        variant='danger'
        confirmDisabled={busyAction === 'void'}
        onCancel={closeVoidInvoiceDialog}
        onConfirm={() => void confirmVoidInvoice()}
      >
        <div className='space-y-2'>
          <Label htmlFor='billing-void-reason'>Reason</Label>
          <Textarea
            id='billing-void-reason'
            value={voidReason}
            onChange={(e) => {
              setVoidReason(e.target.value);
              setVoidError('');
            }}
            rows={3}
            placeholder='Required'
          />
          {voidError ? <AdminInlineError>{voidError}</AdminInlineError> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={emailDialogOpen}
        title='Email invoice PDF'
        description='Sends the issued invoice PDF to the address below (best-effort).'
        confirmLabel='Send email'
        cancelLabel='Cancel'
        confirmDisabled={busyAction === 'email'}
        onCancel={closeEmailInvoiceDialog}
        onConfirm={() => void submitEmailInvoice()}
      >
        <div className='space-y-2'>
          <Label htmlFor='billing-email-dialog-to'>Recipient email</Label>
          <Input
            id='billing-email-dialog-to'
            type='email'
            value={emailDialogTo}
            onChange={(e) => {
              setEmailDialogTo(e.target.value);
              setEmailDialogError('');
            }}
          />
          {emailDialogError ? <AdminInlineError>{emailDialogError}</AdminInlineError> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmPaymentDialogOpen}
        title='Confirm payment'
        description='Marks this pending inbound payment as succeeded. Receipt generation follows server rules.'
        confirmLabel='Confirm payment'
        cancelLabel='Cancel'
        confirmDisabled={busyAction === 'confirm'}
        onCancel={closeConfirmPaymentDialog}
        onConfirm={() => void submitConfirmPayment()}
      >
        <div className='space-y-2'>
          <Label htmlFor='billing-confirm-dialog-ref'>Bank reference / external id (optional)</Label>
          <Input
            id='billing-confirm-dialog-ref'
            value={confirmPaymentExternalRef}
            onChange={(e) => {
              setConfirmPaymentExternalRef(e.target.value);
              setConfirmPaymentError('');
            }}
          />
          {confirmPaymentError ? <AdminInlineError>{confirmPaymentError}</AdminInlineError> : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
