'use client';

import { useCallback, useState } from 'react';

import { openAdminAssetInNewTab } from '@/lib/open-admin-asset-in-new-tab';

export function useOpenAdminAssetInNewTab() {
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [openError, setOpenError] = useState('');

  const openAssetInNewTab = useCallback(async (assetId: string) => {
    setOpenError('');
    setOpeningAssetId(assetId);
    try {
      await openAdminAssetInNewTab(assetId);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'Could not open asset.');
    } finally {
      setOpeningAssetId(null);
    }
  }, []);

  const clearOpenError = useCallback(() => setOpenError(''), []);

  return { openingAssetId, openError, openAssetInNewTab, clearOpenError };
}
