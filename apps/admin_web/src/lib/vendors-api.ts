import { adminApiRequest } from './api-admin-client';
import { asBoolean, asNullableString, asNumber, unwrapPayload } from './api-payload';
import { isRecord } from './type-guards';

import type { Vendor, VendorFilters } from '@/types/vendors';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiOrganizationListResponse = ApiSchemas['AdminOrganizationListResponse'];
type ApiOrganizationResponse = ApiSchemas['AdminOrganizationResponse'];
type ApiCreateOrganizationRequest = ApiSchemas['CreateAdminOrganizationRequest'];
type ApiUpdateOrganizationRequest = ApiSchemas['UpdateAdminOrganizationRequest'];

function parseVendorFromOrganization(value: unknown): Vendor {
  const item = isRecord(value) ? value : {};
  return {
    id: asNullableString(item.id) ?? '',
    name: asNullableString(item.name) ?? '',
    website: asNullableString(item.website),
    active: asBoolean(item.active, true),
    archivedAt: asNullableString(item.archived_at),
    createdAt: asNullableString(item.created_at),
    updatedAt: asNullableString(item.updated_at),
  };
}

export async function listAdminVendors(
  params: Partial<VendorFilters> & { cursor?: string | null; limit?: number },
  signal?: AbortSignal
): Promise<{ items: Vendor[]; nextCursor: string | null; totalCount: number }> {
  const query = new URLSearchParams();
  query.set('relationship_type', 'vendor');
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  if (typeof params.limit === 'number') {
    query.set('limit', `${params.limit}`);
  }
  if (params.query?.trim()) {
    query.set('query', params.query.trim());
  }
  if (params.active) {
    query.set('active', params.active);
  }
  const queryString = query.toString();
  const payload = await adminApiRequest<ApiOrganizationListResponse>({
    endpointPath: `/v1/admin/organizations${queryString ? `?${queryString}` : ''}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items)
      ? root.items.map((entry) => parseVendorFromOrganization(entry))
      : [],
    nextCursor: asNullableString(root.next_cursor),
    totalCount: asNumber(root.total_count, 0),
  };
}

export async function createAdminVendor(body: ApiCreateOrganizationRequest): Promise<Vendor | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: '/v1/admin/organizations',
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseVendorFromOrganization(root.organization) : null;
}

export async function updateAdminVendor(
  vendorId: string,
  body: ApiUpdateOrganizationRequest
): Promise<Vendor | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${vendorId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.organization ? parseVendorFromOrganization(root.organization) : null;
}
