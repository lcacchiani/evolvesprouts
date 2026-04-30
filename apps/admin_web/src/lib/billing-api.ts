import { adminApiRequest } from '@/lib/api-admin-client';
import { unwrapPayload } from '@/lib/api-payload';
import { isRecord } from '@/lib/type-guards';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type CustomerPaymentSummary = ApiSchemas['CustomerPaymentSummary'];

export type CustomerPaymentDetail = CustomerPaymentSummary & {
  unappliedAmount?: string;
};

export async function listCustomerPayments(signal?: AbortSignal): Promise<CustomerPaymentSummary[]> {
  const payload = await adminApiRequest<{ items?: CustomerPaymentSummary[] }>({
    endpointPath: '/v1/admin/billing/payments',
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

export async function createDraftInvoice(
  body: ApiSchemas['CreateDraftInvoiceRequest'],
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
  return unwrapPayload(payload);
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

/** Parse comma- or newline-separated UUIDs from admin input. */
export function parseEnrollmentIdList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseLineTotalsOverridesJson(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'string' || typeof v === 'number') {
      out[k] = String(v);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
