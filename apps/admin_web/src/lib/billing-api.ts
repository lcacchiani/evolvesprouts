import { adminApiRequest } from '@/lib/api-admin-client';
import { unwrapPayload } from '@/lib/api-payload';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type CustomerPaymentSummary = ApiSchemas['CustomerPaymentSummary'];

export type CustomerPaymentDetail = CustomerPaymentSummary & {
  unappliedAmount?: string;
  allocationInvoices?: { invoiceId: string; invoiceNumber: string | null }[];
};

export type CustomerInvoiceSummary = ApiSchemas['CustomerInvoiceSummary'];

export type CustomerInvoiceDetail = ApiSchemas['CustomerInvoiceDetail'];

export async function listCustomerInvoices(
  params: {
    status?: 'draft' | 'issued' | 'void';
    currency?: string;
    cursor?: string | null;
    limit?: number;
  } = {},
  signal?: AbortSignal,
): Promise<{ items: CustomerInvoiceSummary[]; next_cursor: string | null }> {
  const query = new URLSearchParams();
  if (params.status) {
    query.set('status', params.status);
  }
  if (params.currency && params.currency.trim() !== '') {
    query.set('currency', params.currency.trim().toUpperCase());
  }
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  if (params.limit != null) {
    query.set('limit', String(params.limit));
  }
  const qs = query.toString();
  const payload = await adminApiRequest<{
    items?: CustomerInvoiceSummary[];
    next_cursor?: string | null;
  }>({
    endpointPath: qs ? `/v1/admin/billing/invoices?${qs}` : '/v1/admin/billing/invoices',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items) ? root.items : [],
    next_cursor: root.next_cursor ?? null,
  };
}

export async function getCustomerInvoice(id: string, signal?: AbortSignal): Promise<CustomerInvoiceDetail> {
  const payload = await adminApiRequest<{ invoice?: CustomerInvoiceDetail }>({
    endpointPath: `/v1/admin/billing/invoices/${id}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  if (!root.invoice) {
    throw new Error('Invoice response missing invoice.');
  }
  return root.invoice;
}

export async function getCustomerInvoicePdfDownload(
  id: string,
  signal?: AbortSignal,
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const payload = await adminApiRequest<{ downloadUrl?: string; expiresAt?: string }>({
    endpointPath: `/v1/admin/billing/invoices/${id}/pdf`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  const downloadUrl = root.downloadUrl;
  const expiresAt = root.expiresAt;
  if (!downloadUrl || !expiresAt) {
    throw new Error('Invoice PDF response missing download URL.');
  }
  return { downloadUrl, expiresAt };
}

export async function listCustomerPayments(
  params: { invoiceId?: string } = {},
  signal?: AbortSignal,
): Promise<CustomerPaymentSummary[]> {
  const query = new URLSearchParams();
  const inv = params.invoiceId?.trim();
  if (inv) {
    query.set('invoice_id', inv);
  }
  const qs = query.toString();
  const payload = await adminApiRequest<{ items?: CustomerPaymentSummary[] }>({
    endpointPath: qs ? `/v1/admin/billing/payments?${qs}` : '/v1/admin/billing/payments',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items : [];
}

export async function getCustomerPayment(id: string, signal?: AbortSignal): Promise<CustomerPaymentDetail> {
  const payload = await adminApiRequest<CustomerPaymentDetail>({
    endpointPath: `/v1/admin/billing/payments/${id}`,
    method: 'GET',
    signal,
  });
  return unwrapPayload(payload);
}

export async function confirmCustomerPayment(
  id: string,
  body?: { externalReference?: string },
): Promise<CustomerPaymentSummary> {
  const payload = await adminApiRequest<{ payment?: CustomerPaymentSummary }>({
    endpointPath: `/v1/admin/billing/payments/${id}/confirm`,
    method: 'POST',
    body: body && Object.keys(body).length > 0 ? body : undefined,
  });
  const root = unwrapPayload(payload);
  if (!root.payment) {
    throw new Error('Confirm payment response missing payment.');
  }
  return root.payment;
}

export async function createCustomerRefund(
  body: ApiSchemas['CreateCustomerRefundRequest'],
): Promise<CustomerPaymentSummary> {
  const payload = await adminApiRequest<{ payment?: CustomerPaymentSummary }>({
    endpointPath: '/v1/admin/billing/payments',
    method: 'POST',
    body,
    expectedSuccessStatuses: [201],
  });
  const root = unwrapPayload(payload);
  if (!root.payment) {
    throw new Error('Refund response missing payment.');
  }
  return root.payment;
}

export type BillingEnrollmentPickerRow = ApiSchemas['BillingEnrollmentPickerRow'];

export async function listRecentEnrollmentsForInvoicing(
  signal?: AbortSignal,
  params?: { q?: string },
): Promise<{ items: BillingEnrollmentPickerRow[]; truncated: boolean }> {
  const merged: BillingEnrollmentPickerRow[] = [];
  let truncatedOverall = false;
  let cursor: string | null = null;
  let guard = 0;
  while (guard < 200) {
    guard += 1;
    const query = new URLSearchParams();
    query.set('limit', '500');
    if (params?.q != null && params.q.trim() !== '') {
      query.set('q', params.q.trim());
    }
    if (cursor) {
      query.set('cursor', cursor);
    }
    const payload = await adminApiRequest<{
      items?: BillingEnrollmentPickerRow[];
      truncated?: boolean;
      next_cursor?: string | null;
    }>({
      endpointPath: `/v1/admin/billing/enrollments/recent-for-invoicing?${query.toString()}`,
      method: 'GET',
      signal,
    });
    const root = unwrapPayload(payload);
    const page = Array.isArray(root.items) ? root.items : [];
    merged.push(...page);
    if (root.truncated) {
      truncatedOverall = true;
    }
    const next =
      typeof root.next_cursor === 'string' && root.next_cursor.trim() !== ''
        ? root.next_cursor.trim()
        : null;
    if (!next) {
      break;
    }
    cursor = next;
  }

  return { items: merged, truncated: truncatedOverall };
}

export async function createDraftInvoice(
  body:
    | ApiSchemas['CreateDraftInvoiceRequest']
    | ApiSchemas['CreateCustomizedDraftInvoiceRequest'],
): Promise<{ invoiceId: string; status: string }> {
  const payload = await adminApiRequest<{
    invoiceId?: string;
    status?: string;
  }>({
    endpointPath: '/v1/admin/billing/invoices',
    method: 'POST',
    body,
    expectedSuccessStatuses: [201],
  });
  const root = unwrapPayload(payload);
  const invoiceId = typeof root.invoiceId === 'string' ? root.invoiceId : '';
  if (!invoiceId) {
    throw new Error('Create invoice response missing invoiceId.');
  }
  return { invoiceId, status: typeof root.status === 'string' ? root.status : 'draft' };
}

export async function issueInvoice(invoiceId: string): Promise<{
  invoiceId: string;
  invoiceNumber?: string;
  issuedPdfSha256?: string | null;
}> {
  const payload = await adminApiRequest<{
    invoiceId?: string;
    invoiceNumber?: string;
    issuedPdfSha256?: string | null;
  }>({
    endpointPath: `/v1/admin/billing/invoices/${invoiceId}/issue`,
    method: 'POST',
  });
  const root = unwrapPayload(payload);
  const id =
    typeof root.invoiceId === 'string' && root.invoiceId.trim() !== '' ? root.invoiceId : invoiceId;
  if (!id) {
    throw new Error('Issue invoice response missing invoiceId.');
  }
  return {
    invoiceId: id,
    invoiceNumber: root.invoiceNumber,
    issuedPdfSha256: root.issuedPdfSha256,
  };
}

export async function voidInvoice(invoiceId: string, reason: string): Promise<{ invoiceId: string; status: string }> {
  const payload = await adminApiRequest<{
    invoiceId?: string;
    status?: string;
  }>({
    endpointPath: `/v1/admin/billing/invoices/${invoiceId}/void`,
    method: 'POST',
    body: { reason },
  });
  const root = unwrapPayload(payload);
  const id = typeof root.invoiceId === 'string' ? root.invoiceId : invoiceId;
  return { invoiceId: id, status: typeof root.status === 'string' ? root.status : 'void' };
}

export async function emailInvoice(invoiceId: string, toEmail: string): Promise<{ sent: boolean }> {
  const payload = await adminApiRequest<{ sent?: boolean }>({
    endpointPath: `/v1/admin/billing/invoices/${invoiceId}/email`,
    method: 'POST',
    body: { toEmail },
  });
  const root = unwrapPayload(payload);
  return { sent: Boolean(root.sent) };
}

export async function createPaymentAllocation(
  body: ApiSchemas['CreatePaymentAllocationRequest'],
): Promise<{ allocationId: string }> {
  const payload = await adminApiRequest<{ allocationId?: string }>({
    endpointPath: '/v1/admin/billing/allocations',
    method: 'POST',
    body,
    expectedSuccessStatuses: [201],
  });
  const root = unwrapPayload(payload);
  const allocationId = typeof root.allocationId === 'string' ? root.allocationId : '';
  if (!allocationId) {
    throw new Error('Allocation response missing allocationId.');
  }
  return { allocationId };
}

export async function exportBillingCsv(
  exportVersion: '1' | '2' = '2',
  signal?: AbortSignal,
): Promise<string> {
  const query = new URLSearchParams();
  query.set('exportVersion', exportVersion);
  const payload = await adminApiRequest<{ csv?: string }>({
    endpointPath: `/v1/admin/billing/export?${query.toString()}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  if (typeof root.csv !== 'string') {
    throw new Error('Export response missing csv.');
  }
  return root.csv;
}
