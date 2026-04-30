'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Textarea } from '@/components/ui/textarea';
import {
  confirmCustomerPayment,
  createCustomerRefund,
  createDraftInvoice,
  createPaymentAllocation,
  emailInvoice,
  exportBillingCsv,
  getCustomerPayment,
  issueInvoice,
  listCustomerPayments,
  parseEnrollmentIdList,
  parseLineTotalsOverridesJson,
  voidInvoice,
  type CustomerPaymentDetail,
  type CustomerPaymentSummary,
} from '@/lib/billing-api';

const DRAFT_FORM_ID = 'client-billing-draft-invoice-form';
const ISSUE_FORM_ID = 'client-billing-issue-invoice-form';
const VOID_FORM_ID = 'client-billing-void-invoice-form';
const EMAIL_FORM_ID = 'client-billing-email-invoice-form';
const ALLOCATE_FORM_ID = 'client-billing-allocate-form';
const REFUND_FORM_ID = 'client-billing-refund-form';
const CONFIRM_FORM_ID = 'client-billing-confirm-payment-form';

function formatPaymentRowId(id: string | undefined): string {
  if (!id) {
    return '—';
  }
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}

export function ClientInvoicesPanel() {
  const draftDescriptionId = useId();
  const [payments, setPayments] = useState<CustomerPaymentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerPaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [confirmBusyId, setConfirmBusyId] = useState<string | null>(null);

  const [enrollmentIdsText, setEnrollmentIdsText] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('HKD');
  const [lineTotalsJson, setLineTotalsJson] = useState('');

  const [invoiceIdInput, setInvoiceIdInput] = useState('');

  const [voidReason, setVoidReason] = useState('');

  const [emailTo, setEmailTo] = useState('');

  const [allocateInvoiceId, setAllocateInvoiceId] = useState('');
  const [allocateLineId, setAllocateLineId] = useState('');
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocateCurrency, setAllocateCurrency] = useState('HKD');

  const [refundOriginalId, setRefundOriginalId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundCurrency, setRefundCurrency] = useState('HKD');
  const [refundMethod, setRefundMethod] = useState('');
  const [refundStripeId, setRefundStripeId] = useState('');

  const [confirmExternalRef, setConfirmExternalRef] = useState('');

  const loadPayments = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const items = await listCustomerPayments();
      setPayments(items);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load payments.';
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const row = await getCustomerPayment(id);
      setDetail(row);
      setAllocateCurrency(row.currency ?? 'HKD');
      setRefundOriginalId(row.id ?? '');
      setRefundCurrency(row.currency ?? 'HKD');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load payment.';
      setDetailError(message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError('');
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const setBusy = (key: string | null) => {
    setBusyAction(key);
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
    const overrides = parseLineTotalsOverridesJson(lineTotalsJson);
    if (lineTotalsJson.trim() !== '' && overrides === null) {
      setActionError('Line totals override must be empty or valid JSON object (enrollment id → amount).');
      return;
    }
    setBusy('draft');
    try {
      const body: Parameters<typeof createDraftInvoice>[0] = {
        enrollmentIds: ids,
        currency: draftCurrency.trim().toUpperCase() || 'HKD',
      };
      if (overrides) {
        body.lineTotalsByEnrollmentId = overrides;
      }
      const result = await createDraftInvoice(body);
      setInvoiceIdInput(result.invoiceId);
      setActionMessage(`Draft invoice created: ${result.invoiceId}`);
      await loadPayments();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Create draft failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    const id = invoiceIdInput.trim();
    if (!id) {
      setActionError('Invoice id is required.');
      return;
    }
    setBusy('issue');
    try {
      const out = await issueInvoice(id);
      setActionMessage(
        `Issued invoice ${out.invoiceNumber ?? out.invoiceId ?? id}` +
          (out.issuedPdfSha256 ? ` (SHA-256: ${out.issuedPdfSha256.slice(0, 16)}…)` : ''),
      );
      await loadPayments();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Issue failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleVoid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    const id = invoiceIdInput.trim();
    if (!id) {
      setActionError('Invoice id is required.');
      return;
    }
    const reason = voidReason.trim();
    if (!reason) {
      setActionError('Void reason is required.');
      return;
    }
    setBusy('void');
    try {
      await voidInvoice(id, reason);
      setActionMessage(`Invoice voided: ${id}`);
      setVoidReason('');
      await loadPayments();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Void failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    const id = invoiceIdInput.trim();
    if (!id) {
      setActionError('Invoice id is required.');
      return;
    }
    const to = emailTo.trim();
    if (!to) {
      setActionError('Recipient email is required.');
      return;
    }
    setBusy('email');
    try {
      const out = await emailInvoice(id, to);
      setActionMessage(out.sent ? 'Email send accepted.' : 'Email was not confirmed sent.');
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Email failed.');
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
        currency: allocateCurrency.trim().toUpperCase() || 'HKD',
      });
      setActionMessage(`Allocation created: ${out.allocationId}`);
      await loadPayments();
      await loadDetail(selectedId);
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
        currency: refundCurrency.trim().toUpperCase() || 'HKD',
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

  const handleConfirmSelected = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    if (!selectedId) {
      setActionError('Select a pending payment first.');
      return;
    }
    setBusy('confirm');
    try {
      const ext = confirmExternalRef.trim();
      await confirmCustomerPayment(selectedId, ext === '' ? undefined : { externalReference: ext });
      setActionMessage('Payment confirmed.');
      setConfirmExternalRef('');
      await loadPayments();
      await loadDetail(selectedId);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Confirm failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmRow = async (id: string) => {
    setActionError('');
    setActionMessage('');
    setConfirmBusyId(id);
    try {
      await confirmCustomerPayment(id);
      setActionMessage('Payment confirmed.');
      await loadPayments();
      if (selectedId === id) {
        await loadDetail(id);
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Confirm failed.');
    } finally {
      setConfirmBusyId(null);
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
      <AdminEditorCard
        title='Client billing actions'
        description='Create merged draft invoices from enrollments, issue and email PDFs, record allocations and refunds, and confirm offline inbound payments. Row actions apply per payment; invoice id fields accept any draft or issued invoice UUID.'
      >
        {actionMessage ? <p className='text-sm text-emerald-700'>{actionMessage}</p> : null}
        {actionError ? <p className='text-sm text-red-600'>{actionError}</p> : null}

        <div className='rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700'>
          <p className='font-medium text-slate-900'>Selected payment</p>
          {!selectedId ? (
            <p className='mt-1'>Select a row in the table below to load unapplied balance and pre-fill allocation and refund fields.</p>
          ) : detailLoading ? (
            <p className='mt-1'>Loading payment…</p>
          ) : detailError ? (
            <p className='mt-1 text-red-600'>{detailError}</p>
          ) : detail ? (
            <dl className='mt-2 grid gap-1 sm:grid-cols-2'>
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
        </div>

        <div className='space-y-6 border-t border-slate-200 pt-4'>
          <div>
            <h3 className='mb-2 text-sm font-semibold text-slate-900'>Draft invoice from enrollments</h3>
            <p id={draftDescriptionId} className='mb-3 text-xs text-slate-600'>
              Enrollments must share the same bill-to and currency. Optional JSON overrides default line totals
              (enrollment UUID keys, decimal string values).
            </p>
            <form id={DRAFT_FORM_ID} className='space-y-3' onSubmit={(e) => void handleCreateDraft(e)} aria-describedby={draftDescriptionId}>
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
              <div className='flex flex-wrap gap-4'>
                <div>
                  <Label htmlFor='billing-draft-currency'>Currency</Label>
                  <Input
                    id='billing-draft-currency'
                    value={draftCurrency}
                    onChange={(e) => setDraftCurrency(e.target.value)}
                    maxLength={3}
                    className='mt-1 w-24 uppercase'
                    disabled={editorBusy}
                  />
                </div>
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
              <Button type='submit' disabled={editorBusy} form={DRAFT_FORM_ID}>
                {busyAction === 'draft' ? 'Creating…' : 'Create draft invoice'}
              </Button>
            </form>
          </div>

          <div>
            <h3 className='mb-2 text-sm font-semibold text-slate-900'>Invoice id</h3>
            <div className='max-w-xl'>
              <Label htmlFor='billing-invoice-id'>Invoice UUID</Label>
              <Input
                id='billing-invoice-id'
                value={invoiceIdInput}
                onChange={(e) => setInvoiceIdInput(e.target.value)}
                className='mt-1 font-mono text-sm'
                disabled={editorBusy}
              />
            </div>
          </div>

          <div className='flex flex-wrap gap-6'>
            <form id={ISSUE_FORM_ID} className='space-y-2' onSubmit={(e) => void handleIssue(e)}>
              <Button type='submit' disabled={editorBusy} variant='secondary' form={ISSUE_FORM_ID}>
                {busyAction === 'issue' ? 'Issuing…' : 'Issue invoice'}
              </Button>
            </form>
            <form id={VOID_FORM_ID} className='flex flex-col gap-2' onSubmit={(e) => void handleVoid(e)}>
              <div>
                <Label htmlFor='billing-void-reason'>Void reason</Label>
                <Textarea
                  id='billing-void-reason'
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={2}
                  className='mt-1 max-w-md'
                  disabled={editorBusy}
                />
              </div>
              <Button type='submit' disabled={editorBusy} variant='danger' form={VOID_FORM_ID}>
                {busyAction === 'void' ? 'Voiding…' : 'Void invoice'}
              </Button>
            </form>
            <form id={EMAIL_FORM_ID} className='space-y-2' onSubmit={(e) => void handleEmail(e)}>
              <div>
                <Label htmlFor='billing-email-to'>Email PDF to</Label>
                <Input
                  id='billing-email-to'
                  type='email'
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className='mt-1 max-w-md'
                  disabled={editorBusy}
                />
              </div>
              <Button type='submit' disabled={editorBusy} variant='secondary' form={EMAIL_FORM_ID}>
                {busyAction === 'email' ? 'Sending…' : 'Send invoice email'}
              </Button>
            </form>
          </div>

          <div>
            <h3 className='mb-2 text-sm font-semibold text-slate-900'>Allocate selected payment to invoice</h3>
            <form id={ALLOCATE_FORM_ID} className='grid max-w-2xl gap-3 sm:grid-cols-2' onSubmit={(e) => void handleAllocate(e)}>
              <div className='sm:col-span-2'>
                <Label htmlFor='billing-allocate-invoice'>Invoice UUID</Label>
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
                <Input
                  id='billing-allocate-currency'
                  value={allocateCurrency}
                  onChange={(e) => setAllocateCurrency(e.target.value)}
                  maxLength={3}
                  className='mt-1 w-24 uppercase'
                  disabled={editorBusy}
                />
              </div>
              <div className='sm:col-span-2'>
                <Button type='submit' disabled={editorBusy} form={ALLOCATE_FORM_ID}>
                  {busyAction === 'allocate' ? 'Allocating…' : 'Create allocation'}
                </Button>
              </div>
            </form>
          </div>

          <div>
            <h3 className='mb-2 text-sm font-semibold text-slate-900'>Confirm pending inbound payment</h3>
            <form id={CONFIRM_FORM_ID} className='max-w-xl space-y-3' onSubmit={(e) => void handleConfirmSelected(e)}>
              <div>
                <Label htmlFor='billing-confirm-ref'>Bank reference / external id (optional)</Label>
                <Input
                  id='billing-confirm-ref'
                  value={confirmExternalRef}
                  onChange={(e) => setConfirmExternalRef(e.target.value)}
                  className='mt-1'
                  disabled={editorBusy || !selectedId}
                />
              </div>
              <Button type='submit' disabled={editorBusy || !selectedId} form={CONFIRM_FORM_ID}>
                {busyAction === 'confirm' ? 'Confirming…' : 'Confirm selected payment'}
              </Button>
            </form>
          </div>

          <div>
            <h3 className='mb-2 text-sm font-semibold text-slate-900'>Record refund payment row</h3>
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
                <Input
                  id='billing-refund-currency'
                  value={refundCurrency}
                  onChange={(e) => setRefundCurrency(e.target.value)}
                  maxLength={3}
                  className='mt-1 w-24 uppercase'
                  disabled={editorBusy}
                />
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
              <div className='sm:col-span-2'>
                <Button type='submit' disabled={editorBusy} variant='secondary' form={REFUND_FORM_ID}>
                  {busyAction === 'refund' ? 'Recording…' : 'Record refund'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Customer payments'
        description='Recent customer payments and refunds. Select a row for allocation, refund source, or confirm (pending).'
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
                      {formatPaymentRowId(id)}
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
                        disabled={confirmBusyId === id}
                        onClick={() => void handleConfirmRow(id)}
                      >
                        {confirmBusyId === id ? '…' : 'Confirm'}
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
    </div>
  );
}
