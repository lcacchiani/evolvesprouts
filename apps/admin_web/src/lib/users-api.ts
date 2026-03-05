import { adminApiRequest } from './api-admin-client';
import { isRecord } from './type-guards';

import type { components } from '@/types/generated/admin-api.generated';
import type { AdminUser } from '@/types/leads';

type ApiSchemas = components['schemas'];
type ApiAdminUserListResponse = ApiSchemas['AdminUserListResponse'];
type ApiDataWrapper<T> = { data: T };

function unwrapPayload<T>(payload: T | ApiDataWrapper<T>): T {
  if (isRecord(payload) && 'data' in payload) {
    return payload.data as T;
  }
  return payload;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

export async function listAdminUsers(): Promise<{ items: AdminUser[] }> {
  const payload = await adminApiRequest<
    ApiAdminUserListResponse | ApiDataWrapper<ApiAdminUserListResponse>
  >({
    endpointPath: '/v1/admin/users',
    method: 'GET',
  });
  const root = unwrapPayload(payload);
  const items = Array.isArray(root.items)
    ? root.items
        .filter((entry) => isRecord(entry))
        .map((entry) => ({
          sub: asNullableString(entry.sub) ?? '',
          email: asNullableString(entry.email),
          name: asNullableString(entry.name),
        }))
        .filter((entry) => entry.sub.length > 0)
    : [];
  return { items };
}
