import { adminApiRequest } from './api-admin-client';
import { asNullableString, asNumber, unwrapPayload } from './api-payload';
import { isRecord } from './type-guards';

import type { CrmListFilters } from '@/types/crm';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

type ApiContactList = ApiSchemas['AdminContactListResponse'];
type ApiContactResponse = ApiSchemas['AdminContactResponse'];
type ApiFamilyList = ApiSchemas['AdminFamilyListResponse'];
type ApiFamilyResponse = ApiSchemas['AdminFamilyResponse'];
type ApiOrganizationList = ApiSchemas['AdminOrganizationListResponse'];
type ApiOrganizationResponse = ApiSchemas['AdminOrganizationResponse'];
type ApiTagList = ApiSchemas['CrmTagListResponse'];
type ApiCrmPickerList = ApiSchemas['CrmPickerListResponse'];

export type AdminContactRow = ApiSchemas['AdminContact'];
export type AdminFamilyRow = ApiSchemas['AdminFamily'];
export type AdminOrganizationRow = ApiSchemas['AdminOrganization'];
export type CrmTagRef = ApiSchemas['CrmTagRef'];
export type CrmPickerListItem = ApiSchemas['CrmPickerListItem'];

function parseContact(value: unknown): AdminContactRow {
  const row = isRecord(value) ? value : {};
  return row as AdminContactRow;
}

function parseFamily(value: unknown): AdminFamilyRow {
  const row = isRecord(value) ? value : {};
  return row as AdminFamilyRow;
}

function parseOrganization(value: unknown): AdminOrganizationRow {
  const row = isRecord(value) ? value : {};
  return row as AdminOrganizationRow;
}

function parseTag(value: unknown): CrmTagRef {
  const row = isRecord(value) ? value : {};
  return row as CrmTagRef;
}

function parsePickerItem(value: unknown): CrmPickerListItem {
  const row = isRecord(value) ? value : {};
  return row as CrmPickerListItem;
}

export async function listCrmTags(signal?: AbortSignal): Promise<CrmTagRef[]> {
  const payload = await adminApiRequest<ApiTagList>({
    endpointPath: '/v1/admin/contacts/tags',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((t) => parseTag(t)) : [];
}

export async function listCrmFamilyPicker(signal?: AbortSignal): Promise<CrmPickerListItem[]> {
  const payload = await adminApiRequest<ApiCrmPickerList>({
    endpointPath: '/v1/admin/families/picker?limit=100',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((e) => parsePickerItem(e)) : [];
}

export async function listCrmOrganizationPicker(signal?: AbortSignal): Promise<CrmPickerListItem[]> {
  const payload = await adminApiRequest<ApiCrmPickerList>({
    endpointPath: '/v1/admin/organizations/picker?limit=100',
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((e) => parsePickerItem(e)) : [];
}

export async function searchCrmContactsForPicker(
  params: { query: string; excludeContactId?: string | null; limit?: number },
  signal?: AbortSignal
): Promise<CrmPickerListItem[]> {
  const q = new URLSearchParams();
  q.set('query', params.query.trim());
  if (params.excludeContactId?.trim()) {
    q.set('exclude_contact_id', params.excludeContactId.trim());
  }
  if (typeof params.limit === 'number') {
    q.set('limit', `${params.limit}`);
  }
  const payload = await adminApiRequest<ApiCrmPickerList>({
    endpointPath: `/v1/admin/contacts/search?${q.toString()}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return Array.isArray(root.items) ? root.items.map((e) => parsePickerItem(e)) : [];
}

export async function getAdminContact(
  contactId: string,
  signal?: AbortSignal
): Promise<AdminContactRow | null> {
  const payload = await adminApiRequest<ApiContactResponse>({
    endpointPath: `/v1/admin/contacts/${contactId}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return root.contact ? parseContact(root.contact) : null;
}

export async function listAdminContacts(
  params: Partial<CrmListFilters> & { cursor?: string | null; limit?: number },
  signal?: AbortSignal
): Promise<{ items: AdminContactRow[]; nextCursor: string | null; totalCount: number }> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (typeof params.limit === 'number') query.set('limit', `${params.limit}`);
  if (params.query?.trim()) query.set('query', params.query.trim());
  if (params.active) query.set('active', params.active);
  const qs = query.toString();
  const payload = await adminApiRequest<ApiContactList>({
    endpointPath: `/v1/admin/contacts${qs ? `?${qs}` : ''}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items) ? root.items.map((e) => parseContact(e)) : [],
    nextCursor: asNullableString(root.next_cursor),
    totalCount: asNumber(root.total_count, 0),
  };
}

export async function createAdminContact(
  body: ApiSchemas['CreateAdminContactRequest']
): Promise<AdminContactRow | null> {
  const payload = await adminApiRequest<ApiContactResponse>({
    endpointPath: '/v1/admin/contacts',
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.contact ?? null;
}

export async function updateAdminContact(
  contactId: string,
  body: ApiSchemas['UpdateAdminContactRequest']
): Promise<AdminContactRow | null> {
  const payload = await adminApiRequest<ApiContactResponse>({
    endpointPath: `/v1/admin/contacts/${contactId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.contact ?? null;
}

export async function listAdminFamilies(
  params: Partial<CrmListFilters> & { cursor?: string | null; limit?: number },
  signal?: AbortSignal
): Promise<{ items: AdminFamilyRow[]; nextCursor: string | null; totalCount: number }> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (typeof params.limit === 'number') query.set('limit', `${params.limit}`);
  if (params.query?.trim()) query.set('query', params.query.trim());
  if (params.active) query.set('active', params.active);
  const qs = query.toString();
  const payload = await adminApiRequest<ApiFamilyList>({
    endpointPath: `/v1/admin/families${qs ? `?${qs}` : ''}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items) ? root.items.map((e) => parseFamily(e)) : [],
    nextCursor: asNullableString(root.next_cursor),
    totalCount: asNumber(root.total_count, 0),
  };
}

export async function createAdminFamily(
  body: ApiSchemas['CreateAdminFamilyRequest']
): Promise<AdminFamilyRow | null> {
  const payload = await adminApiRequest<ApiFamilyResponse>({
    endpointPath: '/v1/admin/families',
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.family ?? null;
}

export async function updateAdminFamily(
  familyId: string,
  body: ApiSchemas['UpdateAdminFamilyRequest']
): Promise<AdminFamilyRow | null> {
  const payload = await adminApiRequest<ApiFamilyResponse>({
    endpointPath: `/v1/admin/families/${familyId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.family ?? null;
}

export async function addAdminFamilyMember(
  familyId: string,
  body: ApiSchemas['AddFamilyMemberRequest']
): Promise<AdminFamilyRow | null> {
  const payload = await adminApiRequest<ApiFamilyResponse>({
    endpointPath: `/v1/admin/families/${familyId}/members`,
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.family ?? null;
}

export async function removeAdminFamilyMember(
  familyId: string,
  memberId: string
): Promise<AdminFamilyRow | null> {
  const payload = await adminApiRequest<ApiFamilyResponse>({
    endpointPath: `/v1/admin/families/${familyId}/members/${memberId}`,
    method: 'DELETE',
  });
  const root = unwrapPayload(payload);
  return root.family ?? null;
}

export async function listAdminOrganizations(
  params: Partial<CrmListFilters> & { cursor?: string | null; limit?: number },
  signal?: AbortSignal
): Promise<{ items: AdminOrganizationRow[]; nextCursor: string | null; totalCount: number }> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (typeof params.limit === 'number') query.set('limit', `${params.limit}`);
  if (params.query?.trim()) query.set('query', params.query.trim());
  if (params.active) query.set('active', params.active);
  const qs = query.toString();
  const payload = await adminApiRequest<ApiOrganizationList>({
    endpointPath: `/v1/admin/organizations${qs ? `?${qs}` : ''}`,
    method: 'GET',
    signal,
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items) ? root.items.map((e) => parseOrganization(e)) : [],
    nextCursor: asNullableString(root.next_cursor),
    totalCount: asNumber(root.total_count, 0),
  };
}

export async function createAdminOrganization(
  body: ApiSchemas['CreateAdminOrganizationRequest']
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: '/v1/admin/organizations',
    method: 'POST',
    body,
    expectedSuccessStatuses: [200, 201],
  });
  const root = unwrapPayload(payload);
  return root.organization ?? null;
}

export async function updateAdminOrganization(
  organizationId: string,
  body: ApiSchemas['UpdateAdminOrganizationRequest']
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${organizationId}`,
    method: 'PATCH',
    body,
  });
  const root = unwrapPayload(payload);
  return root.organization ?? null;
}

export async function addAdminOrganizationMember(
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
  return root.organization ?? null;
}

export async function removeAdminOrganizationMember(
  organizationId: string,
  memberId: string
): Promise<AdminOrganizationRow | null> {
  const payload = await adminApiRequest<ApiOrganizationResponse>({
    endpointPath: `/v1/admin/organizations/${organizationId}/members/${memberId}`,
    method: 'DELETE',
  });
  const root = unwrapPayload(payload);
  return root.organization ?? null;
}
