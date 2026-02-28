import { AdminApiError, adminApiRequest } from './api-admin-client';
import { isRecord } from './type-guards';

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
type ApiAsset = ApiSchemas['Asset'];
type ApiAssetResponse = ApiSchemas['AssetResponse'];
type ApiAssetListResponse = ApiSchemas['AssetListResponse'];
type ApiAssetGrant = ApiSchemas['AssetGrant'];
type ApiAssetGrantResponse = ApiSchemas['AssetGrantResponse'];
type ApiAssetGrantListResponse = ApiSchemas['AssetGrantListResponse'];
type ApiCreateAssetRequest = ApiSchemas['CreateAssetRequest'];
type ApiCreateAssetResponse = ApiSchemas['CreateAssetResponse'];
type ApiCreateAssetGrantRequest = ApiSchemas['CreateAssetGrantRequest'];
type ApiAssetShareLinkResponse = ApiSchemas['AssetShareLinkResponse'];
type ApiAssetShareLinkPolicyRequest = ApiSchemas['AssetShareLinkPolicyRequest'];

type ApiDataWrapper<T> = {
  data: T;
};

type ApiAssetListPayload =
  | ApiAssetListResponse
  | ApiAsset[]
  | ApiDataWrapper<ApiAssetListResponse | ApiAsset[]>;
type ApiAssetPayload = ApiAssetResponse | ApiAsset | ApiDataWrapper<ApiAssetResponse | ApiAsset>;
type ApiAssetGrantListPayload =
  | ApiAssetGrantListResponse
  | ApiAssetGrant[]
  | ApiDataWrapper<ApiAssetGrantListResponse | ApiAssetGrant[]>;
type ApiAssetGrantPayload =
  | ApiAssetGrantResponse
  | ApiAssetGrant
  | ApiDataWrapper<ApiAssetGrantResponse | ApiAssetGrant>;
type ApiCreateAssetPayload = ApiCreateAssetResponse | ApiDataWrapper<ApiCreateAssetResponse>;
type ApiAssetShareLinkPayload =
  | ApiAssetShareLinkResponse
  | ApiDataWrapper<ApiAssetShareLinkResponse>;

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

function unwrapPayload<T>(payload: T | ApiDataWrapper<T>): T {
  if (isRecord(payload) && 'data' in payload) {
    return payload.data as T;
  }
  return payload;
}

function isApiAsset(value: unknown): value is ApiAsset {
  return isRecord(value) && typeof value.id === 'string';
}

function isApiAssetResponse(value: unknown): value is ApiAssetResponse {
  return isRecord(value) && isApiAsset(value.asset);
}

function isApiAssetGrant(value: unknown): value is ApiAssetGrant {
  return isRecord(value) && typeof value.id === 'string';
}

function isApiAssetGrantResponse(value: unknown): value is ApiAssetGrantResponse {
  return isRecord(value) && isApiAssetGrant(value.grant);
}

function isApiAssetShareLinkResponse(value: unknown): value is ApiAssetShareLinkResponse {
  return isRecord(value) && typeof value.share_url === 'string';
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

function parseAsset(value: ApiAsset): AdminAsset {
  return {
    id: asString(value.id) ?? '',
    title: asString(value.title) ?? 'Untitled asset',
    description: asNullableString(value.description ?? null),
    assetType: parseAssetType(value.asset_type),
    s3Key: asString(value.s3_key) ?? '',
    fileName: asString(value.file_name) ?? '',
    contentType: asNullableString(value.content_type ?? null),
    visibility: parseVisibility(value.visibility),
    createdBy: asNullableString(value.created_by ?? null),
    createdAt: asNullableString(value.created_at ?? null),
    updatedAt: asNullableString(value.updated_at ?? null),
  };
}

function parseGrant(value: ApiAssetGrant): AssetGrant {
  return {
    id: asString(value.id) ?? '',
    assetId: asString(value.asset_id) ?? '',
    grantType: parseGrantType(value.grant_type),
    granteeId: asNullableString(value.grantee_id ?? null),
    grantedBy: asNullableString(value.granted_by ?? null),
    createdAt: asNullableString(value.created_at ?? null),
  };
}

function extractAssetList(payload: ApiAssetListPayload): {
  items: AdminAsset[];
  nextCursor: string | null;
} {
  const root = unwrapPayload(payload);
  if (Array.isArray(root)) {
    return {
      items: root.filter(isApiAsset).map((entry) => parseAsset(entry)),
      nextCursor: null,
    };
  }

  if (!isRecord(root)) {
    return { items: [], nextCursor: null };
  }

  const items = Array.isArray(root.items)
    ? root.items.filter((entry): entry is ApiAsset => isApiAsset(entry)).map((entry) => parseAsset(entry))
    : [];

  return {
    items,
    nextCursor: asString((root as ApiAssetListResponse).next_cursor) ?? null,
  };
}

function extractAsset(payload: ApiAssetPayload): AdminAsset | null {
  const root = unwrapPayload(payload);

  if (isApiAsset(root)) {
    return parseAsset(root);
  }

  if (isApiAssetResponse(root)) {
    return parseAsset(root.asset);
  }

  return null;
}

function extractGrantList(payload: ApiAssetGrantListPayload): AssetGrant[] {
  const root = unwrapPayload(payload);
  if (Array.isArray(root)) {
    return root
      .filter((entry): entry is ApiAssetGrant => isApiAssetGrant(entry))
      .map((entry) => parseGrant(entry));
  }

  if (!isRecord(root) || !Array.isArray(root.items)) {
    return [];
  }

  return root.items
    .filter((entry): entry is ApiAssetGrant => isApiAssetGrant(entry))
    .map((entry) => parseGrant(entry));
}

function extractGrant(payload: ApiAssetGrantPayload): AssetGrant | null {
  const root = unwrapPayload(payload);
  if (isApiAssetGrant(root)) {
    return parseGrant(root);
  }

  if (isApiAssetGrantResponse(root)) {
    return parseGrant(root.grant);
  }

  return null;
}

function extractHeaders(value: Record<string, string> | null | undefined): Record<string, string> {
  if (!value || !isRecord(value)) {
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
  const payload = await adminApiRequest<ApiAssetListPayload>({
    endpointPath,
    method: 'GET',
  });
  const list = extractAssetList(payload);

  return {
    items: list.items,
    nextCursor: list.nextCursor,
  };
}

export async function getAdminAsset(assetId: string): Promise<AdminAsset | null> {
  const payload = await adminApiRequest<ApiAssetPayload>({
    endpointPath: `/v1/admin/assets/${assetId}`,
    method: 'GET',
  });
  return extractAsset(payload);
}

export async function createAdminAsset(
  input: UpsertAdminAssetInput
): Promise<CreateAdminAssetResult> {
  const payload = await adminApiRequest<ApiCreateAssetPayload>({
    endpointPath: '/v1/admin/assets',
    method: 'POST',
    body: normalizeAssetInput(input),
    expectedSuccessStatuses: [200, 201],
  });

  const root = unwrapPayload(payload);
  const upload: CreatedAssetUpload = {
    uploadUrl: asString(root.upload_url) ?? null,
    uploadMethod: asString(root.upload_method) ?? 'PUT',
    uploadHeaders: extractHeaders(root.upload_headers),
    expiresAt: asNullableString(root.expires_at ?? null),
  };

  return {
    asset: isApiAsset(root.asset) ? parseAsset(root.asset) : null,
    upload,
  };
}

export async function updateAdminAsset(
  assetId: string,
  input: UpsertAdminAssetInput
): Promise<AdminAsset | null> {
  const payload = await adminApiRequest<ApiAssetPayload>({
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
  const payload = await adminApiRequest<ApiAssetGrantListPayload>({
    endpointPath: `/v1/admin/assets/${assetId}/grants`,
    method: 'GET',
  });

  return extractGrantList(payload);
}

export async function createAdminAssetGrant(
  assetId: string,
  input: CreateAssetGrantInput
): Promise<AssetGrant | null> {
  const requestBody: ApiCreateAssetGrantRequest = {
    grant_type: input.grantType,
    grantee_id: input.granteeId?.trim() || null,
  };

  const payload = await adminApiRequest<ApiAssetGrantPayload>({
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

function parseAssetShareLink(payload: ApiAssetShareLinkPayload, fallbackAssetId: string): AssetShareLink {
  const root = unwrapPayload(payload);

  if (!isApiAssetShareLinkResponse(root)) {
    throw new Error('Share URL was not returned by the API.');
  }

  const shareUrl = asString(root.share_url);
  if (!shareUrl) {
    throw new Error('Share URL was not returned by the API.');
  }

  return {
    assetId: asString(root.asset_id) ?? fallbackAssetId,
    shareUrl,
    allowedDomains: asStringArray(root.allowed_domains),
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
  const payload = await adminApiRequest<ApiAssetShareLinkPayload>({
    endpointPath: `/v1/admin/assets/${assetId}/share-link`,
    method: 'POST',
    body: normalizeShareLinkPolicyInput(input),
    expectedSuccessStatuses: [200, 201],
  });
  return parseAssetShareLink(payload, assetId);
}

export async function getAdminAssetShareLink(assetId: string): Promise<AssetShareLink | null> {
  try {
    const payload = await adminApiRequest<ApiAssetShareLinkPayload>({
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
  const payload = await adminApiRequest<ApiAssetShareLinkPayload>({
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
