import { adminApiRequest } from './api-admin-client';
import { unwrapPayload } from './api-payload';
import { isRecord } from './type-guards';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type AdminTagRow = ApiSchemas['AdminTagRef'];

export type AdminTagListFilter = 'active' | 'archived' | 'all';

export type AdminTagDeleteOutcome = ApiSchemas['AdminTagDeleteResponse'];

function parseAdminTag(value: unknown): AdminTagRow {
  const row = isRecord(value) ? value : {};
  return row as AdminTagRow;
}

export async function listAdminTags(
  params?: { filter?: AdminTagListFilter },
  signal?: AbortSignal
): Promise<AdminTagRow[]> {
  const query = new URLSearchParams();
  const filter = params?.filter ?? 'active';
  if (filter === 'all') {
    query.set('include_archived', 'true');
  } else if (filter === 'archived') {
    query.set('archived_only', 'true');
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

export async function deleteOrArchiveAdminTag(tagId: string): Promise<AdminTagDeleteOutcome> {
  const payload = await adminApiRequest<ApiSchemas['AdminTagDeleteResponse']>({
    endpointPath: `/v1/admin/tags/${tagId}`,
    method: 'DELETE',
  });
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { deleted: true, usage_count: 0 };
  }
  return {
    deleted: Boolean(root.deleted),
    usage_count: typeof root.usage_count === 'number' ? root.usage_count : 0,
    tag: root.tag ? parseAdminTag(root.tag) : undefined,
  };
}
