import { adminApiRequest } from '@/lib/api-admin-client';
import { unwrapPayload } from '@/lib/api-payload';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type CompletionCertificate = ApiSchemas['CompletionCertificate'];

export interface CompletionCertificateListParams {
  contactId?: string;
  serviceId?: string;
  instanceId?: string;
  status?: ApiSchemas['CompletionCertificateStatus'];
  limit?: number;
  cursor?: string;
}

export interface CompletionCertificateDraftPayload {
  contactId: string;
  serviceId: string;
  instanceId: string;
  participationDate: string;
  programTitle?: string | null;
  partnerOrganizationId?: string | null;
}

function toIssueBody(payload: CompletionCertificateDraftPayload): ApiSchemas['IssueCompletionCertificateRequest'] {
  return {
    contact_id: payload.contactId,
    service_id: payload.serviceId,
    instance_id: payload.instanceId,
    participation_date: payload.participationDate,
    program_title: payload.programTitle?.trim() || null,
    partner_organization_id: payload.partnerOrganizationId?.trim() || null,
  };
}

export async function listCompletionCertificates(
  params: CompletionCertificateListParams = {},
  signal?: AbortSignal,
): Promise<{
  items: CompletionCertificate[];
  nextCursor: string | null;
  totalCount?: number;
}> {
  const q = new URLSearchParams();
  if (params.contactId?.trim()) {
    q.set('contact_id', params.contactId.trim());
  }
  if (params.serviceId?.trim()) {
    q.set('service_id', params.serviceId.trim());
  }
  if (params.instanceId?.trim()) {
    q.set('instance_id', params.instanceId.trim());
  }
  if (params.status) {
    q.set('status', params.status);
  }
  if (typeof params.limit === 'number') {
    q.set('limit', String(params.limit));
  }
  if (params.cursor?.trim()) {
    q.set('cursor', params.cursor.trim());
  }
  const qs = q.toString();
  const payload = await adminApiRequest<ApiSchemas['CompletionCertificateListResponse']>({
    endpointPath: qs
      ? `/v1/admin/completion-certificates?${qs}`
      : '/v1/admin/completion-certificates',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items) ? root.items : [],
    nextCursor: root.next_cursor ?? null,
    totalCount: root.total_count ?? undefined,
  };
}

export async function previewCompletionCertificatePdf(
  payload: CompletionCertificateDraftPayload,
  signal?: AbortSignal,
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const body = await adminApiRequest<ApiSchemas['PdfDownloadResponse']>({
    endpointPath: '/v1/admin/completion-certificates/preview',
    method: 'POST',
    body: toIssueBody(payload),
    signal,
  });
  const root = unwrapPayload(body);
  if (!root.downloadUrl || !root.expiresAt) {
    throw new Error('Preview response missing download URL.');
  }
  return { downloadUrl: root.downloadUrl, expiresAt: root.expiresAt };
}

export async function issueCompletionCertificate(
  payload: CompletionCertificateDraftPayload,
  signal?: AbortSignal,
): Promise<CompletionCertificate> {
  const body = await adminApiRequest<ApiSchemas['CompletionCertificateResponse']>({
    endpointPath: '/v1/admin/completion-certificates',
    method: 'POST',
    body: toIssueBody(payload),
    signal,
  });
  const root = unwrapPayload(body);
  if (!root.certificate) {
    throw new Error('Issue response missing certificate.');
  }
  return root.certificate;
}

export async function getCompletionCertificatePdfDownload(
  id: string,
  signal?: AbortSignal,
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const body = await adminApiRequest<ApiSchemas['PdfDownloadResponse']>({
    endpointPath: `/v1/admin/completion-certificates/${id}/pdf`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(body);
  if (!root.downloadUrl || !root.expiresAt) {
    throw new Error('PDF response missing download URL.');
  }
  return { downloadUrl: root.downloadUrl, expiresAt: root.expiresAt };
}

export async function voidCompletionCertificate(
  id: string,
  signal?: AbortSignal,
): Promise<CompletionCertificate> {
  const body = await adminApiRequest<ApiSchemas['CompletionCertificateResponse']>({
    endpointPath: `/v1/admin/completion-certificates/${id}/void`,
    method: 'POST',
    signal,
  });
  const root = unwrapPayload(body);
  if (!root.certificate) {
    throw new Error('Void response missing certificate.');
  }
  return root.certificate;
}

export async function deleteCompletionCertificate(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await adminApiRequest({
    endpointPath: `/v1/admin/completion-certificates/${id}`,
    method: 'DELETE',
    signal,
  });
}
