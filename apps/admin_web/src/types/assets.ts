export const ASSET_TYPES = ['guide', 'video', 'pdf', 'document'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_VISIBILITIES = ['public', 'restricted'] as const;
export type AssetVisibility = (typeof ASSET_VISIBILITIES)[number];

export const ACCESS_GRANT_TYPES = ['all_authenticated', 'organization', 'user'] as const;
export type AccessGrantType = (typeof ACCESS_GRANT_TYPES)[number];

export interface AdminAsset {
  id: string;
  title: string;
  description: string | null;
  assetType: AssetType;
  s3Key: string;
  fileName: string;
  fileSizeBytes: number | null;
  contentType: string | null;
  visibility: AssetVisibility;
  organizationId: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AssetGrant {
  id: string;
  assetId: string;
  grantType: AccessGrantType;
  granteeId: string | null;
  grantedBy: string | null;
  createdAt: string | null;
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
  title: string;
  description?: string | null;
  assetType: AssetType;
  fileName: string;
  contentType?: string | null;
  fileSizeBytes?: number | null;
  visibility: AssetVisibility;
  organizationId?: string | null;
}

export interface CreatedAssetUpload {
  uploadUrl: string | null;
  uploadMethod: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string | null;
}

export interface CreateAssetGrantInput {
  grantType: AccessGrantType;
  granteeId?: string | null;
}
