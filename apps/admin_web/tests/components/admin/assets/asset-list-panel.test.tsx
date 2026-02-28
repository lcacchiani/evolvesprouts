import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AssetListPanel } from '@/components/admin/assets/asset-list-panel';
import { createAdminAssetFixture } from '../../../fixtures/assets';

const FIXTURE_ASSET = createAdminAssetFixture({
  title: 'Infant Nutrition Guide',
  s3Key: 'assets/infant-nutrition-guide.pdf',
  fileName: 'infant-nutrition-guide.pdf',
});

function renderPanel(overrides: Partial<ComponentProps<typeof AssetListPanel>> = {}) {
  const onQueryChange = vi.fn();
  const onVisibilityChange = vi.fn();
  const onLoadMore = vi.fn().mockResolvedValue(undefined);
  const onSelectAsset = vi.fn();
  const onDeleteAsset = vi.fn().mockResolvedValue(undefined);

  render(
    <AssetListPanel
      assets={[FIXTURE_ASSET]}
      selectedAssetId={null}
      filters={{ query: '', visibility: '' }}
      isLoadingAssets={false}
      isLoadingMoreAssets={false}
      isDeletingAssetId={null}
      assetsError=''
      nextCursor='cursor-1'
      onQueryChange={onQueryChange}
      onVisibilityChange={onVisibilityChange}
      onLoadMore={onLoadMore}
      onSelectAsset={onSelectAsset}
      onDeleteAsset={onDeleteAsset}
      {...overrides}
    />
  );

  return {
    onQueryChange,
    onVisibilityChange,
    onLoadMore,
    onSelectAsset,
    onDeleteAsset,
  };
}

describe('AssetListPanel', () => {
  it('renders table data and handles filter and load-more actions', async () => {
    const user = userEvent.setup();
    const { onQueryChange, onLoadMore } = renderPanel();

    expect(screen.getByText('Infant Nutrition Guide')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Search by title or file name'), 'guide');
    expect(onQueryChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard row selection', async () => {
    const user = userEvent.setup();
    const { onSelectAsset } = renderPanel();

    const row = screen.getByText('Infant Nutrition Guide').closest('tr');
    expect(row).toBeTruthy();
    row?.focus();
    await user.keyboard('{Enter}');

    expect(onSelectAsset).toHaveBeenCalledWith('asset-1');
  });

  it('confirms deletion before invoking onDeleteAsset', async () => {
    const user = userEvent.setup();
    const { onDeleteAsset } = renderPanel();

    const row = screen.getByText('Infant Nutrition Guide').closest('tr');
    expect(row).toBeTruthy();
    const deleteButton = within(row as HTMLElement).getByRole('button', { name: 'Delete asset' });
    await user.click(deleteButton);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDeleteAsset).toHaveBeenCalledWith('asset-1');
  });
});
