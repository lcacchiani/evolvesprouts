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
import { CheckIcon, ViewIcon, VoidExpenseIcon } from '@/components/icons/action-icons';
import {
  CUSTOMIZED_DRAFT_INVOICE_FORM_ID,
  CustomizedDraftInvoiceCard,
} from '@/components/admin/finance/customized-draft-invoice-card';
import {
  confirmCustomerPayment,
  createCustomerRefund,
  createDraftInvoice,
  createPaymentAllocation,
  emailInvoice,
  exportBillingCsv,
  getCustomerInvoicePdfDownload,
  getCustomerPayment,
  issueInvoice,
  listCustomerInvoices,
  listCustomerPayments,
  listRecentEnrollmentsForInvoicing,
  voidInvoice,
  type BillingEnrollmentPickerRow,
  type CustomerInvoiceSummary,
  type CustomerPaymentDetail,
  type CustomerPaymentSummary,
} from '@/lib/billing-api';
import { getAdminDefaultCurrencyCode } from '@/lib/config';
import {
  getCurrencyOptions,
  INSTANCE_TABLE_TIER_COHORT_HEADER,
  formatDate,
  formatTierCohortDisplay,
} from '@/lib/format';
import { formatAmountInCurrency } from '@/lib/vendor-spend';

const DRAFT_FORM_ID = 'client-billing-draft-invoice-form';
const ALLOCATE_FORM_ID = 'client-billing-allocate-form';
const REFUND_FORM_ID = 'client-billing-refund-form';

function formatTruncatedId(id: string | null | undefined): string {
  if (!id) {
    return '—';
  }
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}

/** List table: capitalize first letter of API status (for example `draft` → `Draft`). */
function formatCustomerInvoiceStatusLabel(status: string | undefined): string {
  const t = status?.trim() ?? '';
  if (t === '') {
    return '—';
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function currencySelectValue(
  code: string,
  options: readonly { value: string }[],
  fallback: string,
): string {
  const normalized = code.trim().toUpperCase() || fallback;
  return options.some((o) => o.value === normalized) ? normalized : fallback;
}

function enrollmentNeedsAmountConfirmation(row: BillingEnrollmentPickerRow): boolean {
  const ap = row.amountPaid?.trim() ?? '';
  if (ap === '') {
    return true;
  }
  const n = Number.parseFloat(ap);
  return Number.isNaN(n);
}

function parseAmountInput(raw: string): number | null {
  const t = raw.trim();
  if (t === '') {
    return null;
  }
  const n = Number.parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function defaultLineAmount(row: BillingEnrollmentPickerRow): string {
  return row.amountPaid != null && row.amountPaid.trim() !== '' ? row.amountPaid.trim() : '0';
}

/** Party column: `name · email` when email is non-empty; otherwise party name only. */
function formatEnrollmentPartyCellDisplay(row: BillingEnrollmentPickerRow): string {
  const party = row.partyDisplayName?.trim() ?? '';
  const email = row.partyEmail?.trim() ?? '';
  if (email === '') {
    return party;
  }
  if (party === '') {
    return email;
  }
  return `${party} \u00b7 ${email}`;
}

function lineAmountsDiffer(input: string, row: BillingEnrollmentPickerRow): boolean {
  const trimmed = input.trim();
  const baseline = defaultLineAmount(row);
  const a = Number.parseFloat(trimmed === '' ? baseline : trimmed);
  const b = Number.parseFloat(baseline);
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    return Math.abs(a - b) > 1e-9;
  }
  return trimmed !== '' && trimmed !== baseline;
}

/** Normalize admin-entered CSV/semicolon-separated emails for the billing API (comma-separated). */
function normalizeInvoiceRecipientList(raw: string): string {
  return raw
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(', ');
}

export function ClientInvoicesPanel() {
  const draftFilterId = useId();
  const draftModeId = useId();
  const currencyOptions = useMemo(() => getCurrencyOptions(), []);
  const defaultCurrency = useMemo(() => getAdminDefaultCurrencyCode(), []);

  const [draftCreationMode, setDraftCreationMode] = useState<'enrollment' | 'customized'>('enrollment');
  const [customizedFormSubmitEnabled, setCustomizedFormSubmitEnabled] = useState(false);

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
  const [issuedInvoiceEmailCsv, setIssuedInvoiceEmailCsv] = useState('');
  const [issuedInvoiceEmailError, setIssuedInvoiceEmailError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTargetId, setVoidInvoiceTargetId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] = useState(false);
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [confirmPaymentExternalRef, setConfirmPaymentExternalRef] = useState('');
  const [confirmPaymentError, setConfirmPaymentError] = useState('');

  const [enrollmentPickerRows, setEnrollmentPickerRows] = useState<BillingEnrollmentPickerRow[]>([]);
  const [enrollmentPickerTruncated, setEnrollmentPickerTruncated] = useState(false);
  const [enrollmentPickerLoading, setEnrollmentPickerLoading] = useState(true);
  const [enrollmentPickerError, setEnrollmentPickerError] = useState('');
  const [enrollmentFilter, setEnrollmentFilter] = useState('');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(() => new Set());
  const [lineOverrideByEnrollmentId, setLineOverrideByEnrollmentId] = useState<Record<string, string>>({});

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
  const prevIssuedInvoiceSelectionRef = useRef<string | null>(null);
  const issuedInvoiceEmailDirtyRef = useRef(false);

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

  const [debouncedEnrollmentFilter, setDebouncedEnrollmentFilter] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedEnrollmentFilter(enrollmentFilter.trim()), 350);
    return () => window.clearTimeout(t);
  }, [enrollmentFilter]);

  const loadEnrollmentPicker = useCallback(
    async (signal?: AbortSignal, overrideServerQuery?: string) => {
      setEnrollmentPickerLoading(true);
      setEnrollmentPickerError('');
      const serverQuery =
        overrideServerQuery !== undefined ? overrideServerQuery : debouncedEnrollmentFilter;
      try {
        const { items, truncated } = await listRecentEnrollmentsForInvoicing(
          signal,
          serverQuery === '' ? undefined : { q: serverQuery },
        );
        setEnrollmentPickerRows(items);
        setEnrollmentPickerTruncated(truncated);
        setSelectedEnrollmentIds((prev) => {
          const allowed = new Set(
            items.filter((r) => !r.invoiceLinked).map((r) => r.enrollmentId),
          );
          const next = new Set<string>();
          for (const id of prev) {
            if (allowed.has(id)) {
              next.add(id);
            }
          }
          return next;
        });
      } catch (caught) {
        if (caught instanceof Error && caught.name === 'AbortError') {
          return;
        }
        const message =
          caught instanceof Error ? caught.message : 'Failed to load enrollments for invoicing.';
        setEnrollmentPickerError(message);
        setEnrollmentPickerRows([]);
        setEnrollmentPickerTruncated(false);
      } finally {
        setEnrollmentPickerLoading(false);
      }
    },
    [debouncedEnrollmentFilter],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadEnrollmentPicker(ac.signal);
    return () => ac.abort();
  }, [loadEnrollmentPicker]);

  const selectableFilteredRows = useMemo(
    () => enrollmentPickerRows.filter((row) => !row.invoiceLinked),
    [enrollmentPickerRows],
  );

  const selectedEnrollmentRows = useMemo(() => {
    const map = new Map(enrollmentPickerRows.map((r) => [r.enrollmentId, r]));
    const out: BillingEnrollmentPickerRow[] = [];
    for (const id of selectedEnrollmentIds) {
      const row = map.get(id);
      if (row) {
        out.push(row);
      }
    }
    return out;
  }, [enrollmentPickerRows, selectedEnrollmentIds]);

  const draftSelectionIssue = useMemo(() => {
    if (selectedEnrollmentRows.length === 0) {
      return '';
    }
    const currencies = new Set(selectedEnrollmentRows.map((r) => r.currency));
    if (currencies.size > 1) {
      return 'Selected enrollments must share one currency.';
    }
    const billKeys = new Set(selectedEnrollmentRows.map((r) => r.billToMergeKey));
    if (billKeys.size > 1) {
      return 'Selected enrollments must share the same bill-to (contact/family/organization).';
    }
    return '';
  }, [selectedEnrollmentRows]);

  const draftAmountIssue = useMemo(() => {
    for (const row of selectedEnrollmentRows) {
      const raw = lineOverrideByEnrollmentId[row.enrollmentId] ?? defaultLineAmount(row);
      const amt = parseAmountInput(raw);
      if (amt === null) {
        return 'Enter a valid number for every line total (0 is allowed).';
      }
    }
    return '';
  }, [selectedEnrollmentRows, lineOverrideByEnrollmentId]);

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

  const selectedIssuedInvoice = useMemo(() => {
    if (!selectedInvoiceId) {
      return null;
    }
    return invoices.find((inv) => inv.id === selectedInvoiceId) ?? null;
  }, [invoices, selectedInvoiceId]);

  useEffect(() => {
    setIssuedInvoiceEmailError('');
    const inv = selectedIssuedInvoice;

    if (!inv || inv.status !== 'issued') {
      prevIssuedInvoiceSelectionRef.current = null;
      issuedInvoiceEmailDirtyRef.current = false;
      setIssuedInvoiceEmailCsv('');
      return;
    }

    const id = inv.id ?? '';
    const bill = inv.billToEmail?.trim() ?? '';

    if (prevIssuedInvoiceSelectionRef.current !== id) {
      prevIssuedInvoiceSelectionRef.current = id;
      issuedInvoiceEmailDirtyRef.current = false;
      setIssuedInvoiceEmailCsv(bill);
      return;
    }

    if (!issuedInvoiceEmailDirtyRef.current) {
      setIssuedInvoiceEmailCsv(bill);
    }
  }, [selectedIssuedInvoice]);

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
    } catch (caught) {
      setVoidError(caught instanceof Error ? caught.message : 'Void failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleEmailIssuedInvoice = async () => {
    const id = selectedInvoiceId?.trim();
    if (!id || selectedIssuedInvoice?.status !== 'issued') {
      return;
    }
    const normalized = normalizeInvoiceRecipientList(issuedInvoiceEmailCsv);
    if (normalized === '') {
      setIssuedInvoiceEmailError('Enter at least one recipient email (comma-separated).');
      return;
    }
    setIssuedInvoiceEmailError('');
    setBusy('email');
    try {
      const out = await emailInvoice(id, normalized);
      setActionMessage(out.sent ? 'Email send accepted.' : 'Email was not confirmed sent.');
      await loadInvoicesFirstPage();
    } catch (caught) {
      setIssuedInvoiceEmailError(caught instanceof Error ? caught.message : 'Email failed.');
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
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Issue failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleOpenInvoicePdfPreview = async (invoiceId: string) => {
    setActionError('');
    setBusy('pdf');
    try {
      const { downloadUrl } = await getCustomerInvoicePdfDownload(invoiceId);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not open invoice preview.');
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
    const ids = [...selectedEnrollmentIds];
    if (ids.length === 0) {
      setActionError('Select at least one enrollment.');
      return;
    }
    const rowsById = new Map(enrollmentPickerRows.map((r) => [r.enrollmentId, r]));
    for (const id of ids) {
      const row = rowsById.get(id);
      if (!row || row.invoiceLinked) {
        setActionError('The enrollment list changed; update your selection and try again.');
        return;
      }
    }
    const overrides: Record<string, string> = {};
    for (const id of ids) {
      const row = rowsById.get(id);
      if (!row) {
        continue;
      }
      const raw = lineOverrideByEnrollmentId[id] ?? defaultLineAmount(row);
      const trimmed = raw.trim();
      const normalized = trimmed === '' ? defaultLineAmount(row) : trimmed;
      if (lineAmountsDiffer(normalized, row)) {
        overrides[id] = normalized;
      }
    }
    if (draftSelectionIssue) {
      setActionError(draftSelectionIssue);
      return;
    }
    if (draftAmountIssue) {
      setActionError(draftAmountIssue);
      return;
    }
    setBusy('draft');
    try {
      const body: Parameters<typeof createDraftInvoice>[0] = {
        draftKind: 'enrollment_merge',
        enrollmentIds: ids,
      };
      if (Object.keys(overrides).length > 0) {
        body.lineTotalsByEnrollmentId = overrides;
      }
      const result = await createDraftInvoice(body);
      setSelectedInvoiceId(result.invoiceId);
      setAllocateInvoiceId(result.invoiceId);
      setActionMessage(`Draft invoice created: ${result.invoiceId}`);
      await loadPayments();
      await loadInvoicesFirstPage();
      await loadEnrollmentPicker(undefined, enrollmentFilter.trim());
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
        title='Create draft invoice'
        description='Choose enrollment-based (merge selected enrollments) or customized (manual lines, not linked to enrollments). One primary action submits the visible form.'
        actions={
          <Button
            type='submit'
            form={draftCreationMode === 'enrollment' ? DRAFT_FORM_ID : CUSTOMIZED_DRAFT_INVOICE_FORM_ID}
            disabled={
              editorBusy ||
              (draftCreationMode === 'enrollment' &&
                (Boolean(draftSelectionIssue) || Boolean(draftAmountIssue))) ||
              (draftCreationMode === 'customized' && !customizedFormSubmitEnabled)
            }
            aria-label={
              draftCreationMode === 'enrollment'
                ? 'Create draft invoice from selected enrollments'
                : 'Create draft invoice from custom lines'
            }
          >
            {busyAction === 'draft' || busyAction === 'customized'
              ? 'Creating…'
              : 'Create draft invoice'}
          </Button>
        }
      >
        <div className='space-y-4'>
          <div className='max-w-md'>
            <Label htmlFor={draftModeId}>Draft type</Label>
            <Select
              id={draftModeId}
              className='mt-1 w-full'
              value={draftCreationMode}
              onChange={(e) => {
                const v = e.target.value === 'customized' ? 'customized' : 'enrollment';
                setDraftCreationMode(v);
                if (v === 'enrollment') {
                  setCustomizedFormSubmitEnabled(false);
                }
              }}
              disabled={editorBusy}
            >
              <option value='enrollment'>Enrollment-based</option>
              <option value='customized'>Customized (manual lines)</option>
            </Select>
          </div>
          {draftCreationMode === 'enrollment' ? (
            <form
              id={DRAFT_FORM_ID}
              className='space-y-4'
              onSubmit={(e) => void handleCreateDraft(e)}
            >
              <p className='text-sm text-slate-600'>
                Shown: enrollments from the last 90 days (by enrolled date), excluding cancelled. Rows
                already on a draft or issued invoice cannot be selected. Selected rows must share bill-to and
                currency on the server.
              </p>
              <div className='flex flex-wrap items-end gap-3'>
                <div className='min-w-[220px] flex-1'>
                  <Label htmlFor={draftFilterId}>Filter enrollments</Label>
                  <Input
                    id={draftFilterId}
                    className='mt-1'
                    value={enrollmentFilter}
                    onChange={(e) => setEnrollmentFilter(e.target.value)}
                    placeholder='Search name, email, title, tier, cohort…'
                    disabled={editorBusy}
                  />
                </div>
              </div>
              {enrollmentPickerTruncated ? (
                <p className='text-sm text-amber-800' role='status'>
                  Enrollment list may be incomplete (server capped additional pages). Narrow your filter or
                  contact support for full exports.
                </p>
              ) : null}
              <section aria-label='Enrollment picker'>
                <AdminDataTable>
                  <AdminDataTableHead>
                    <tr>
                      <th className='px-3 py-2'>
                        <input
                          type='checkbox'
                          aria-label='Select all visible enrollments'
                          checked={
                            selectableFilteredRows.length > 0 &&
                            selectableFilteredRows.every((row) =>
                              selectedEnrollmentIds.has(row.enrollmentId),
                            )
                          }
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedEnrollmentIds((prev) => {
                              const next = new Set(prev);
                              if (checked) {
                                for (const row of selectableFilteredRows) {
                                  next.add(row.enrollmentId);
                                }
                              } else {
                                for (const row of selectableFilteredRows) {
                                  next.delete(row.enrollmentId);
                                }
                              }
                              return next;
                            });
                          }}
                          disabled={
                            editorBusy ||
                            enrollmentPickerLoading ||
                            selectableFilteredRows.length === 0
                          }
                        />
                      </th>
                      <th className='px-3 py-2'>Party</th>
                      <th className='px-3 py-2'>Instance</th>
                      <th className='max-w-[14rem] px-3 py-2'>{INSTANCE_TABLE_TIER_COHORT_HEADER}</th>
                      <th className='px-3 py-2 text-right'>Price</th>
                      <th className='px-3 py-2'>Enrolled</th>
                      <th className='px-3 py-2'>Invoice</th>
                    </tr>
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {enrollmentPickerLoading ? (
                      <tr>
                        <td colSpan={7} className='px-3 py-6 text-sm text-slate-600'>
                          Loading enrollments…
                        </td>
                      </tr>
                    ) : enrollmentPickerRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className='px-3 py-6 text-sm text-slate-600'>
                          No enrollments match this filter.
                        </td>
                      </tr>
                    ) : (
                      enrollmentPickerRows.map((row) => {
                        const blocked = row.invoiceLinked;
                        const checked = selectedEnrollmentIds.has(row.enrollmentId);
                        const blockedNoteId = `billing-enrollment-blocked-note-${row.enrollmentId}`;
                        const amountPaidTrimmed = row.amountPaid?.trim() ?? '';
                        const currencyCode =
                          (row.currency ?? defaultCurrency).trim().toUpperCase() || defaultCurrency;
                        const parsedAmount = Number.parseFloat(amountPaidTrimmed);
                        const priceLabel =
                          amountPaidTrimmed !== '' && Number.isFinite(parsedAmount)
                            ? formatAmountInCurrency(parsedAmount, currencyCode)
                            : '—';
                        const tierCohortDisplay = formatTierCohortDisplay(
                          row.serviceTierName,
                          row.instanceCohort,
                        );
                        const partyCellDisplay = formatEnrollmentPartyCellDisplay(row);
                        return (
                          <tr
                            key={row.enrollmentId}
                            className={blocked ? 'bg-slate-50 text-slate-500' : undefined}
                          >
                            <td className='px-3 py-2 align-top'>
                              <input
                                type='checkbox'
                                aria-label={`Select enrollment ${row.enrollmentId}`}
                                aria-describedby={blocked ? blockedNoteId : undefined}
                                checked={checked}
                                disabled={editorBusy || blocked}
                                onChange={(event) => {
                                  const nextChecked = event.target.checked;
                                  setSelectedEnrollmentIds((prev) => {
                                    const next = new Set(prev);
                                    if (nextChecked) {
                                      next.add(row.enrollmentId);
                                    } else {
                                      next.delete(row.enrollmentId);
                                    }
                                    return next;
                                  });
                                }}
                              />
                              {blocked ? (
                                <span id={blockedNoteId} className='sr-only'>
                                  Already on a draft or issued invoice.
                                </span>
                              ) : null}
                            </td>
                            <td className='min-w-0 max-w-[22rem] break-words px-3 py-2 align-top text-sm'>
                              {partyCellDisplay !== '' ? partyCellDisplay : '—'}
                            </td>
                            <td className='px-3 py-2 align-top text-sm'>{row.instanceTitle ?? '—'}</td>
                            <td className='max-w-[14rem] min-w-0 break-words px-3 py-2 align-top text-sm'>
                              {tierCohortDisplay !== '' ? tierCohortDisplay : '—'}
                            </td>
                            <td className='px-3 py-2 align-top text-right text-sm tabular-nums'>
                              {priceLabel}
                            </td>
                            <td className='px-3 py-2 align-top whitespace-nowrap text-sm'>
                              {row.enrolledAt ? row.enrolledAt.slice(0, 10) : '—'}
                            </td>
                            <td className='px-3 py-2 align-top text-sm'>
                              {blocked ? 'On draft/issued invoice' : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </AdminDataTableBody>
                </AdminDataTable>
              </section>
              {draftSelectionIssue ? (
                <p className='text-sm text-amber-800'>{draftSelectionIssue}</p>
              ) : null}
              {draftAmountIssue ? (
                <p className='text-sm text-amber-800'>{draftAmountIssue}</p>
              ) : null}
              <div className='space-y-2'>
                <Label>Line totals override</Label>
                <p className='text-xs text-slate-600'>
                  Defaults follow each enrollment&apos;s amount. Adjust selected rows only.
                </p>
                {selectedEnrollmentRows.length === 0 ? (
                  <p className='text-sm text-slate-600'>
                    Select enrollments above to override line amounts.
                  </p>
                ) : (
                  <div className='space-y-2'>
                    {selectedEnrollmentRows.map((row) => {
                      const needsAmt = enrollmentNeedsAmountConfirmation(row);
                      return (
                        <div
                          key={row.enrollmentId}
                          className={`flex flex-wrap items-center gap-3 border px-3 py-2 ${
                            needsAmt ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                          }`}
                        >
                          <span className='min-w-[180px] flex-1 text-sm'>{row.partyDisplayName}</span>
                          <span className='font-mono text-xs text-slate-600'>{row.enrollmentId}</span>
                          {needsAmt ? (
                            <p className='w-full text-xs text-amber-900'>
                              This enrollment has no recorded amount; enter a line total (use 0 for a
                              zero-dollar line).
                            </p>
                          ) : null}
                          <div className='flex items-center gap-2'>
                            <Label
                              className='sr-only'
                              htmlFor={`billing-line-override-${row.enrollmentId}`}
                            >
                              Line total for {row.partyDisplayName}
                            </Label>
                            <Input
                              id={`billing-line-override-${row.enrollmentId}`}
                              className='w-36 font-mono text-sm tabular-nums'
                              inputMode='decimal'
                              value={
                                lineOverrideByEnrollmentId[row.enrollmentId] ??
                                defaultLineAmount(row)
                              }
                              onChange={(e) =>
                                setLineOverrideByEnrollmentId((prev) => ({
                                  ...prev,
                                  [row.enrollmentId]: e.target.value,
                                }))
                              }
                              disabled={editorBusy}
                            />
                            <span className='text-xs text-slate-600'>{row.currency}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </form>
          ) : (
            <CustomizedDraftInvoiceCard
              defaultCurrency={defaultCurrency}
              currencyOptions={currencyOptions}
              editorBusy={editorBusy}
              loadParents={draftCreationMode === 'customized'}
              onRequestBusy={(busy) => setBusy(busy ? 'customized' : null)}
              onDraftError={(msg) => setActionError(msg)}
              onValidityChange={setCustomizedFormSubmitEnabled}
              onCreated={async (invoiceId) => {
                setActionError('');
                setSelectedInvoiceId(invoiceId);
                setAllocateInvoiceId(invoiceId);
                setActionMessage(`Draft invoice created: ${invoiceId}`);
                await loadPayments();
                await loadInvoicesFirstPage();
              }}
            />
          )}
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Customer invoices'
        description='Cursor-paginated invoices (newest first). Use Operations to issue or void. Select a row to set allocation defaults; when the selection is issued, use Email recipients and Send email below.'
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
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {selectedIssuedInvoice?.status === 'issued' ? (
              <div className='ml-auto flex min-w-[min(100%,20rem)] max-w-xl flex-1 flex-col gap-1 sm:min-w-[18rem]'>
                <Label htmlFor='billing-issued-invoice-emails'>Email recipients (comma-separated)</Label>
                <div className='flex flex-wrap items-end gap-2'>
                  <Input
                    id='billing-issued-invoice-emails'
                    className='min-w-0 flex-1 font-mono text-sm'
                    autoComplete='off'
                    value={issuedInvoiceEmailCsv}
                    onChange={(e) => {
                      issuedInvoiceEmailDirtyRef.current = true;
                      setIssuedInvoiceEmailCsv(e.target.value);
                      setIssuedInvoiceEmailError('');
                    }}
                    disabled={editorBusy}
                    placeholder='billing@example.com, accounts@example.com'
                  />
                  <Button
                    type='button'
                    size='sm'
                    variant='secondary'
                    disabled={editorBusy || busyAction === 'email'}
                    onClick={() => void handleEmailIssuedInvoice()}
                  >
                    {busyAction === 'email' ? 'Sending…' : 'Send email'}
                  </Button>
                </div>
                {issuedInvoiceEmailError ? (
                  <AdminInlineError>{issuedInvoiceEmailError}</AdminInlineError>
                ) : null}
              </div>
            ) : null}
          </div>
        }
      >
        <section aria-label='Customer invoices list'>
        <AdminDataTable tableClassName='min-w-[900px]'>
          <AdminDataTableHead>
            <tr>
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
              const totalRaw = inv.total?.trim() ?? '';
              const parsedTotal = Number.parseFloat(totalRaw);
              const currencyCode =
                (inv.currency ?? defaultCurrency).trim().toUpperCase() || defaultCurrency;
              const totalDisplay =
                totalRaw !== '' && Number.isFinite(parsedTotal)
                  ? formatAmountInCurrency(parsedTotal, currencyCode)
                  : '—';
              return (
                <tr
                  key={id || `invoice-row-${String(index)}`}
                  className={selected ? 'cursor-pointer bg-sky-50' : id ? 'cursor-pointer' : undefined}
                  onClick={() => {
                    setSelectedInvoiceId(id || null);
                    if (id) {
                      setAllocateInvoiceId(id);
                    }
                  }}
                >
                  <td className='px-3 py-2'>
                    {formatCustomerInvoiceStatusLabel(inv.status)}
                  </td>
                  <td className='px-3 py-2'>{inv.invoiceNumber ?? '—'}</td>
                  <td className='px-3 py-2 text-slate-700'>
                    {inv.billToDisplayName ?? inv.billToEmail ?? '—'}
                  </td>
                  <td className='px-3 py-2'>{totalDisplay}</td>
                  <td className='px-3 py-2'>{inv.lineCount ?? 0}</td>
                  <td className='px-3 py-2'>{formatDate(inv.createdAt ?? null)}</td>
                  <td
                    className='px-3 py-2 text-right'
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <div className='flex flex-wrap justify-end gap-1'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={editorBusy || !id}
                        onClick={() => void handleOpenInvoicePdfPreview(id)}
                        aria-label='Preview invoice PDF'
                        title='Preview invoice PDF'
                        aria-busy={busyAction === 'pdf'}
                      >
                        {busyAction === 'pdf' ? (
                          <span
                            className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-transparent'
                            aria-hidden
                          />
                        ) : (
                          <ViewIcon className='h-4 w-4' aria-hidden />
                        )}
                      </Button>
                      {inv.status === 'draft' ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          disabled={editorBusy || !id}
                          onClick={() => void handleIssueRow(id)}
                          aria-label='Issue invoice'
                          title='Issue invoice'
                          aria-busy={busyAction === 'issue'}
                        >
                          {busyAction === 'issue' ? (
                            <span
                              className='inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-transparent'
                              aria-hidden
                            />
                          ) : (
                            <CheckIcon className='h-4 w-4' aria-hidden />
                          )}
                        </Button>
                      ) : null}
                      {inv.status !== 'void' ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          disabled={editorBusy || !id}
                          onClick={() => openVoidInvoiceDialog(id)}
                          aria-label='Void invoice'
                          title='Void invoice'
                        >
                          <VoidExpenseIcon className='h-4 w-4' aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
        </section>
      </PaginatedTableCard>

      <AdminEditorCard
        title='Allocate selected payment to invoice'
        description='Select a payment in the table below first. Paste invoice and optional line UUIDs from your records or billing export.'
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
