import type { AdminAsset, AssetGrant } from '@/types/assets';

const DEFAULT_ADMIN_ASSET: AdminAsset = {
  id: 'asset-1',
  title: 'Infant Guide',
  description: null,
  assetType: 'document',
  s3Key: 'assets/infant-guide.pdf',
  fileName: 'infant-guide.pdf',
  contentType: 'application/pdf',
  visibility: 'restricted',
  createdBy: 'admin@example.com',
  createdAt: '2026-02-27T00:00:00.000Z',
  updatedAt: '2026-02-27T00:00:00.000Z',
};

const DEFAULT_ASSET_GRANT: AssetGrant = {
  id: 'grant-1',
  assetId: 'asset-1',
  grantType: 'organization',
  granteeId: 'org-1',
  grantedBy: 'admin@example.com',
  createdAt: '2026-02-27T00:00:00.000Z',
};

export function createAdminAssetFixture(overrides: Partial<AdminAsset> = {}): AdminAsset {
  return { ...DEFAULT_ADMIN_ASSET, ...overrides };
}

export function createAssetGrantFixture(overrides: Partial<AssetGrant> = {}): AssetGrant {
  return { ...DEFAULT_ASSET_GRANT, ...overrides };
}
