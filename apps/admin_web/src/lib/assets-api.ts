import { AdminApiError, adminApiRequest } from './api-admin-client';

import type {
  AdminAsset,
  AssetGrant,
  AssetType,
  AssetVisibility,
  CreateAssetGrantInput,
  CreatedAssetUpload,
  ListAdminAssetsInput,
  PaginatedList,
  UpsertAdminAssetInput,
} from '@/types/assets';
import { ACCESS_GRANT_TYPES, ASSET_TYPES, ASSET_VISIBILITIES } from '@/types/assets';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiCreateAssetRequest = ApiSchemas['CreateAssetRequest'];
type ApiCreateAssetGrantRequest = ApiSchemas['CreateAssetGrantRequest'];
type ApiAssetShareLinkPolicyRequest = ApiSchemas['AssetShareLinkPolicyRequest'];

export interface CreateAdminAssetResult {
  asset: AdminAsset | null;
  upload: CreatedAssetUpload;
}

export interface AssetShareLink {
  assetId: string;
  shareUrl: string;
  allowedDomains: string[];
}

export interface AssetShareLinkPolicyInput {
  allowedDomains: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickFirst(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseAssetType(value: unknown): AssetType {
  if (typeof value === 'string' && ASSET_TYPES.includes(value as AssetType)) {
    return value as AssetType;
  }
  return 'document';
}

function parseVisibility(value: unknown): AssetVisibility {
  if (typeof value === 'string' && ASSET_VISIBILITIES.includes(value as AssetVisibility)) {
    return value as AssetVisibility;
  }
  return 'restricted';
}

function parseGrantType(value: unknown): AssetGrant['grantType'] {
  if (typeof value === 'string' && ACCESS_GRANT_TYPES.includes(value as AssetGrant['grantType'])) {
    return value as AssetGrant['grantType'];
  }
  return 'user';
}

function payloadRoot(payload: unknown): unknown {
  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data;
  }
  return payload;
}

function parseAsset(value: unknown): AdminAsset | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(pickFirst(value, ['id']));
  if (!id) {
    return null;
  }

  return {
    id,
    title: asString(pickFirst(value, ['title'])) ?? 'Untitled asset',
    description: asNullableString(pickFirst(value, ['description'])),
    assetType: parseAssetType(pickFirst(value, ['assetType', 'asset_type'])),
    s3Key: asString(pickFirst(value, ['s3Key', 's3_key'])) ?? '',
    fileName: asString(pickFirst(value, ['fileName', 'file_name'])) ?? '',
    contentType: asNullableString(pickFirst(value, ['contentType', 'content_type'])),
    visibility: parseVisibility(pickFirst(value, ['visibility'])),
    createdBy: asNullableString(pickFirst(value, ['createdBy', 'created_by'])),
    createdAt: asNullableString(pickFirst(value, ['createdAt', 'created_at'])),
    updatedAt: asNullableString(pickFirst(value, ['updatedAt', 'updated_at'])),
  };
}

function parseGrant(value: unknown): AssetGrant | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(pickFirst(value, ['id']));
  if (!id) {
    return null;
  }

  return {
    id,
    assetId: asString(pickFirst(value, ['assetId', 'asset_id'])) ?? '',
    grantType: parseGrantType(pickFirst(value, ['grantType', 'grant_type'])),
    granteeId: asNullableString(pickFirst(value, ['granteeId', 'grantee_id'])),
    grantedBy: asNullableString(pickFirst(value, ['grantedBy', 'granted_by'])),
    createdAt: asNullableString(pickFirst(value, ['createdAt', 'created_at'])),
  };
}

function extractListItems(
  payload: unknown,
  keys: string[]
): { items: unknown[]; nextCursor: string | null } {
  const root = payloadRoot(payload);

  if (Array.isArray(root)) {
    return { items: root, nextCursor: null };
  }

  if (!isRecord(root)) {
    return { items: [], nextCursor: null };
  }

  const maybeItems = pickFirst(root, keys);
  const items = Array.isArray(maybeItems) ? maybeItems : [];
  const nextCursor =
    asString(pickFirst(root, ['nextCursor', 'next_cursor', 'cursor'])) ??
    asString(pickFirst(isRecord(payload) ? payload : {}, ['nextCursor', 'next_cursor', 'cursor'])) ??
    null;

  return { items, nextCursor };
}

function extractAsset(payload: unknown): AdminAsset | null {
  const root = payloadRoot(payload);
  const direct = parseAsset(root);
  if (direct) {
    return direct;
  }

  if (!isRecord(root)) {
    return null;
  }

  return (
    parseAsset(pickFirst(root, ['asset', 'item'])) ??
    parseAsset(pickFirst(root, ['result'])) ??
    null
  );
}

function extractGrant(payload: unknown): AssetGrant | null {
  const root = payloadRoot(payload);
  const direct = parseGrant(root);
  if (direct) {
    return direct;
  }

  if (!isRecord(root)) {
    return null;
  }

  return (
    parseGrant(pickFirst(root, ['grant', 'item'])) ??
    parseGrant(pickFirst(root, ['result'])) ??
    null
  );
}

function extractHeaders(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const headers: Record<string, string> = {};
  for (const [headerName, headerValue] of Object.entries(value)) {
    if (typeof headerValue === 'string') {
      headers[headerName] = headerValue;
    }
  }
  return headers;
}

function normalizeAssetInput(input: UpsertAdminAssetInput): ApiCreateAssetRequest {
  const trimmedDescription = input.description?.trim() ?? '';
  const trimmedContentType = input.contentType?.trim() ?? '';

  return {
    title: input.title.trim(),
    description: trimmedDescription || null,
    asset_type: input.assetType,
    file_name: input.fileName.trim(),
    content_type: trimmedContentType || null,
    visibility: input.visibility,
  };
}

export async function listAdminAssets(
  input: ListAdminAssetsInput = {}
): Promise<PaginatedList<AdminAsset>> {
  const params = new URLSearchParams();
  if (input.query?.trim()) {
    params.set('query', input.query.trim());
  }
  if (input.visibility?.trim()) {
    params.set('visibility', input.visibility);
  }
  if (input.assetType?.trim()) {
    params.set('asset_type', input.assetType);
  }
  if (input.cursor?.trim()) {
    params.set('cursor', input.cursor);
  }
  if (typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0) {
    params.set('limit', `${Math.floor(input.limit)}`);
  }

  const queryString = params.toString();
  const endpointPath = queryString ? `/v1/admin/assets?${queryString}` : '/v1/admin/assets';
  const payload = await adminApiRequest<unknown>({ endpointPath, method: 'GET' });
  const list = extractListItems(payload, ['items', 'assets', 'results']);

  return {
    items: list.items.map((entry) => parseAsset(entry)).filter((entry): entry is AdminAsset => !!entry),
    nextCursor: list.nextCursor,
  };
}

export async function getAdminAsset(assetId: string): Promise<AdminAsset | null> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/assets/${assetId}`,
    method: 'GET',
  });
  return extractAsset(payload);
}

export async function createAdminAsset(
  input: UpsertAdminAssetInput
): Promise<CreateAdminAssetResult> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: '/v1/admin/assets',
    method: 'POST',
    body: normalizeAssetInput(input),
    expectedSuccessStatuses: [200, 201],
  });

  const root = payloadRoot(payload);
  const rootRecord = isRecord(root) ? root : {};
  const upload: CreatedAssetUpload = {
    uploadUrl:
      asString(
        pickFirst(rootRecord, [
          'uploadUrl',
          'upload_url',
          'presignedUrl',
          'presigned_url',
          'url',
        ])
      ) ?? null,
    uploadMethod: asString(pickFirst(rootRecord, ['uploadMethod', 'upload_method'])) ?? 'PUT',
    uploadHeaders: extractHeaders(pickFirst(rootRecord, ['uploadHeaders', 'upload_headers'])),
    expiresAt: asNullableString(pickFirst(rootRecord, ['expiresAt', 'expires_at'])),
  };

  return {
    asset: extractAsset(payload),
    upload,
  };
}

export async function updateAdminAsset(
  assetId: string,
  input: UpsertAdminAssetInput
): Promise<AdminAsset | null> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/assets/${assetId}`,
    method: 'PUT',
    body: normalizeAssetInput(input),
  });
  return extractAsset(payload);
}

export async function deleteAdminAsset(assetId: string): Promise<void> {
  await adminApiRequest({
    endpointPath: `/v1/admin/assets/${assetId}`,
    method: 'DELETE',
    expectedSuccessStatuses: [200, 202, 204],
  });
}

export async function listAdminAssetGrants(assetId: string): Promise<AssetGrant[]> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/assets/${assetId}/grants`,
    method: 'GET',
  });

  const list = extractListItems(payload, ['items', 'grants', 'results']);
  return list.items.map((entry) => parseGrant(entry)).filter((entry): entry is AssetGrant => !!entry);
}

export async function createAdminAssetGrant(
  assetId: string,
  input: CreateAssetGrantInput
): Promise<AssetGrant | null> {
  const requestBody: ApiCreateAssetGrantRequest = {
    grant_type: input.grantType,
    grantee_id: input.granteeId?.trim() || null,
  };

  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/assets/${assetId}/grants`,
    method: 'POST',
    body: requestBody,
    expectedSuccessStatuses: [200, 201],
  });

  return extractGrant(payload);
}

export async function deleteAdminAssetGrant(assetId: string, grantId: string): Promise<void> {
  await adminApiRequest({
    endpointPath: `/v1/admin/assets/${assetId}/grants/${grantId}`,
    method: 'DELETE',
    expectedSuccessStatuses: [200, 202, 204],
  });
}

function parseAssetShareLink(payload: unknown, fallbackAssetId: string): AssetShareLink {
  const root = payloadRoot(payload);
  const rootRecord = isRecord(root) ? root : {};

  const shareUrl =
    asString(pickFirst(rootRecord, ['shareUrl', 'share_url', 'url'])) ??
    asString(pickFirst(isRecord(payload) ? payload : {}, ['shareUrl', 'share_url', 'url']));
  if (!shareUrl) {
    throw new Error('Share URL was not returned by the API.');
  }

  const allowedDomains = asStringArray(
    pickFirst(rootRecord, ['allowedDomains', 'allowed_domains'])
  );

  return {
    assetId: asString(pickFirst(rootRecord, ['assetId', 'asset_id'])) ?? fallbackAssetId,
    shareUrl,
    allowedDomains,
  };
}

function normalizeShareLinkPolicyInput(
  input: AssetShareLinkPolicyInput | undefined
): ApiAssetShareLinkPolicyRequest | undefined {
  if (!input) {
    return undefined;
  }
  return {
    allowed_domains: input.allowedDomains,
  };
}

export async function getOrCreateAdminAssetShareLink(
  assetId: string,
  input?: AssetShareLinkPolicyInput
): Promise<AssetShareLink> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/assets/${assetId}/share-link`,
    method: 'POST',
    body: normalizeShareLinkPolicyInput(input),
    expectedSuccessStatuses: [200, 201],
  });
  return parseAssetShareLink(payload, assetId);
}

export async function getAdminAssetShareLink(assetId: string): Promise<AssetShareLink | null> {
  try {
    const payload = await adminApiRequest<unknown>({
      endpointPath: `/v1/admin/assets/${assetId}/share-link`,
      method: 'GET',
      expectedSuccessStatuses: [200],
    });
    return parseAssetShareLink(payload, assetId);
  } catch (error) {
    if (error instanceof AdminApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export async function rotateAdminAssetShareLink(
  assetId: string,
  input?: AssetShareLinkPolicyInput
): Promise<AssetShareLink> {
  const payload = await adminApiRequest<unknown>({
    endpointPath: `/v1/admin/assets/${assetId}/share-link/rotate`,
    method: 'POST',
    body: normalizeShareLinkPolicyInput(input),
    expectedSuccessStatuses: [200],
  });
  return parseAssetShareLink(payload, assetId);
}

export async function revokeAdminAssetShareLink(assetId: string): Promise<void> {
  await adminApiRequest({
    endpointPath: `/v1/admin/assets/${assetId}/share-link`,
    method: 'DELETE',
    expectedSuccessStatuses: [200, 202, 204],
  });
}

export async function uploadFileToPresignedUrl({
  uploadUrl,
  uploadMethod,
  uploadHeaders,
  file,
  signal,
}: {
  uploadUrl: string;
  uploadMethod?: string;
  uploadHeaders?: Record<string, string>;
  file: File;
  signal?: AbortSignal;
}): Promise<void> {
  const method = (uploadMethod || 'PUT').toUpperCase();
  const headers: Record<string, string> = {
    ...(uploadHeaders ?? {}),
  };
  if (!headers['Content-Type'] && file.type) {
    headers['Content-Type'] = file.type;
  }

  const response = await fetch(uploadUrl, {
    method,
    headers,
    body: file,
    signal,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}.`);
  }
}
