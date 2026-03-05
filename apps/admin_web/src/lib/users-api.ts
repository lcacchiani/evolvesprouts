import { adminApiRequest } from './api-admin-client';
import { asNullableString, unwrapPayload } from './api-payload';
import { isRecord } from './type-guards';

import type { components } from '@/types/generated/admin-api.generated';
import type { AdminUser } from '@/types/leads';

type ApiSchemas = components['schemas'];
type ApiAdminUserListResponse = ApiSchemas['AdminUserListResponse'];

export async function listAdminUsers(): Promise<{ items: AdminUser[] }> {
  const payload = await adminApiRequest<ApiAdminUserListResponse>({
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
