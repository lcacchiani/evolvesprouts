import { adminApiRequest } from './api-admin-client';
import { unwrapPayload } from './api-payload';
import { isRecord } from './type-guards';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type AdminTagRow = ApiSchemas['AdminTagRef'];

function parseAdminTag(value: unknown): AdminTagRow {
  const row = isRecord(value) ? value : {};
  return row as AdminTagRow;
}

export async function listAdminTags(
  params?: { includeArchived?: boolean },
  signal?: AbortSignal
): Promise<AdminTagRow[]> {
  const query = new URLSearchParams();
  if (params?.includeArchived) {
    query.set('include_archived', 'true');
  }
  const qs = query.toString();
  const payload = await adminApiRequest<ApiSchemas['AdminTagListResponse']>({
    endpointPath: `/v1/admin/tags${qs ? `?${qs}` : ''}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((t) => parseAdminTag(t)) : [];
}

export async function createAdminTag(
  body: ApiSchemas['CreateAdminTagRequest']
): Promise<AdminTagRow | null> {
  const payload = await adminApiRequest<ApiSchemas['AdminTagResponse']>({
    endpointPath: '/v1/admin/tags',
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.tag ? parseAdminTag(root.tag) : null;
}

export async function updateAdminTag(
  tagId: string,
  body: ApiSchemas['UpdateAdminTagRequest']
): Promise<AdminTagRow | null> {
  const payload = await adminApiRequest<ApiSchemas['AdminTagResponse']>({
    endpointPath: `/v1/admin/tags/${tagId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.tag ? parseAdminTag(root.tag) : null;
}

export async function deleteOrArchiveAdminTag(
  tagId: string
): Promise<{ status: 204 } | { status: 200; tag: AdminTagRow }> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/tags/${tagId}`,
    method: 'DELETE',
    expectedSuccessStatuses: [200, 204],
  });
  if (payload === null) {
    return { status: 204 };
  }
  const root = unwrapPayload(payload);
  if (isRecord(root) && root.tag) {
    return { status: 200, tag: parseAdminTag(root.tag) };
  }
  return { status: 204 };
}
