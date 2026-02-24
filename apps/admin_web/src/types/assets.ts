import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiAsset = ApiSchemas['Asset'];
type ApiAssetGrant = ApiSchemas['AssetGrant'];
type ApiCreateAssetRequest = ApiSchemas['CreateAssetRequest'];
type ApiCreateAssetResponse = ApiSchemas['CreateAssetResponse'];
type ApiCreateAssetGrantRequest = ApiSchemas['CreateAssetGrantRequest'];

type OptionalToNullable<T> = Exclude<T, undefined>;

function defineEnumValues<T extends string>() {
  return <U extends readonly T[]>(values: U & ([T] extends [U[number]] ? unknown : never)) => values;
}

export type AssetType = ApiAsset['asset_type'];
export const ASSET_TYPES = defineEnumValues<AssetType>()(
  ['guide', 'video', 'pdf', 'document'] as const satisfies readonly AssetType[]
);

export type AssetVisibility = ApiAsset['visibility'];
export const ASSET_VISIBILITIES = defineEnumValues<AssetVisibility>()(
  ['public', 'restricted'] as const satisfies readonly AssetVisibility[]
);

export type AccessGrantType = ApiAssetGrant['grant_type'];
export const ACCESS_GRANT_TYPES = defineEnumValues<AccessGrantType>()(
  ['all_authenticated', 'organization', 'user'] as const satisfies readonly AccessGrantType[]
);

export interface AdminAsset {
  id: ApiAsset['id'];
  title: ApiAsset['title'];
  description: OptionalToNullable<ApiAsset['description']>;
  assetType: AssetType;
  s3Key: ApiAsset['s3_key'];
  fileName: ApiAsset['file_name'];
  fileSizeBytes: OptionalToNullable<ApiAsset['file_size_bytes']>;
  contentType: OptionalToNullable<ApiAsset['content_type']>;
  visibility: AssetVisibility;
  organizationId: OptionalToNullable<ApiAsset['organization_id']>;
  createdBy: OptionalToNullable<ApiAsset['created_by']>;
  createdAt: OptionalToNullable<ApiAsset['created_at']>;
  updatedAt: OptionalToNullable<ApiAsset['updated_at']>;
}

export interface AssetGrant {
  id: ApiAssetGrant['id'];
  assetId: ApiAssetGrant['asset_id'];
  grantType: AccessGrantType;
  granteeId: OptionalToNullable<ApiAssetGrant['grantee_id']>;
  grantedBy: OptionalToNullable<ApiAssetGrant['granted_by']>;
  createdAt: OptionalToNullable<ApiAssetGrant['created_at']>;
}

export interface PaginatedList<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

export interface ListAdminAssetsInput {
  query?: string;
  visibility?: AssetVisibility | '';
  assetType?: AssetType | '';
  cursor?: string | null;
  limit?: number;
}

export interface UpsertAdminAssetInput {
  title: ApiCreateAssetRequest['title'];
  description?: OptionalToNullable<ApiCreateAssetRequest['description']>;
  assetType: ApiCreateAssetRequest['asset_type'];
  fileName: ApiCreateAssetRequest['file_name'];
  contentType?: OptionalToNullable<ApiCreateAssetRequest['content_type']>;
  fileSizeBytes?: OptionalToNullable<ApiCreateAssetRequest['file_size_bytes']>;
  visibility: ApiCreateAssetRequest['visibility'];
  organizationId?: OptionalToNullable<ApiCreateAssetRequest['organization_id']>;
}

export interface CreatedAssetUpload {
  uploadUrl: OptionalToNullable<ApiCreateAssetResponse['upload_url']>;
  uploadMethod: string;
  uploadHeaders: NonNullable<ApiCreateAssetResponse['upload_headers']>;
  expiresAt: OptionalToNullable<ApiCreateAssetResponse['expires_at']>;
}

export interface CreateAssetGrantInput {
  grantType: ApiCreateAssetGrantRequest['grant_type'];
  granteeId?: OptionalToNullable<ApiCreateAssetGrantRequest['grantee_id']>;
}
