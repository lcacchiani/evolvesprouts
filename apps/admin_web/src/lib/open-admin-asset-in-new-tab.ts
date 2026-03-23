import { getUserAssetDownloadUrl } from '@/lib/assets-api';

/**
 * Fetches a presigned URL and opens the asset in a new browser tab (admin API).
 */
export async function openAdminAssetInNewTab(assetId: string): Promise<void> {
  const url = await getUserAssetDownloadUrl(assetId);
  window.open(url, '_blank', 'noopener,noreferrer');
}
