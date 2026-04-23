import { adminApiRequest } from './api-admin-client';
import { asNullableString, asNumber, unwrapPayload } from './api-payload';
import {
  parseAdminOrganization,
  type AdminOrganizationRow,
} from '@/lib/entity-api';

import type { PartnerFilters } from '@/types/partners';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiOrganizationList = ApiSchemas['AdminOrganizationListResponse'];
type ApiOrganizationResponse = ApiSchemas['AdminOrganizationResponse'];

export type { AdminOrganizationRow };

export async function listAdminPartners(
  params: Partial<PartnerFilters> & { cursor?: string | null; limit?: number },
  signal?: AbortSignal
): Promise<{ items: AdminOrganizationRow[]; nextCursor: string | null; totalCount: number }> {
  const query = new URLSearchParams();
  query.set('relationship_type', 'partner');
  if (params.cursor) query.set('cursor', params.cursor);
  if (typeof params.limit === 'number') query.set('limit', `${params.limit}`);
  if (params.query?.trim()) query.set('query', params.query.trim());
  if (params.active) query.set('active', params.active);
  const qs = query.toString();
  const payload = await adminApiRequest<ApiOrganizationList>({
    endpointPath: `/v1/admin/organizations?${qs}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items) ? root.items.map((e) => parseAdminOrganization(e)) : [],
    nextCursor: asNullableString(root.next_cursor),
    totalCount: asNumber(root.total_count, 0),
  };
}

export async function createAdminPartner(
  body: ApiSchemas['CreateAdminOrganizationRequest']
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: '/v1/admin/organizations',
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseAdminOrganization(root.organization) : null;
}

export async function updateAdminPartner(
  organizationId: string,
  body: ApiSchemas['UpdateAdminOrganizationRequest']
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${organizationId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseAdminOrganization(root.organization) : null;
}

export async function deleteAdminPartner(organizationId: string): Promise<void> {
  await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/organizations/${organizationId}`,
    method: 'DELETE',
    expectedSuccessStatuses: [204],
  });
}

export async function addPartnerMember(
  organizationId: string,
  body: ApiSchemas['AddOrganizationMemberRequest']
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${organizationId}/members`,
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseAdminOrganization(root.organization) : null;
}

export async function removePartnerMember(
  organizationId: string,
  memberId: string
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${organizationId}/members/${memberId}`,
    method: 'DELETE',
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseAdminOrganization(root.organization) : null;
}

export async function patchPartnerMember(
  organizationId: string,
  memberId: string,
  body: ApiSchemas['UpdateOrganizationMemberRequest']
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${organizationId}/members/${memberId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseAdminOrganization(root.organization) : null;
}
