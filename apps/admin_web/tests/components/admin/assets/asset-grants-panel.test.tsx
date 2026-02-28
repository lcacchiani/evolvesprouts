import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AssetGrantsPanel } from '@/components/admin/assets/asset-grants-panel';
import type { AdminAsset, AssetGrant } from '@/types/assets';

const SELECTED_ASSET: AdminAsset = {
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

const GRANT: AssetGrant = {
  id: 'grant-1',
  assetId: 'asset-1',
  grantType: 'organization',
  granteeId: 'org-1',
  grantedBy: 'admin@example.com',
  createdAt: '2026-02-27T00:00:00.000Z',
};

function renderPanel(overrides: Partial<ComponentProps<typeof AssetGrantsPanel>> = {}) {
  const onCreateGrant = vi.fn().mockResolvedValue(undefined);
  const onDeleteGrant = vi.fn().mockResolvedValue(undefined);

  render(
    <AssetGrantsPanel
      selectedAsset={SELECTED_ASSET}
      grants={[]}
      isLoadingGrants={false}
      grantsError=''
      grantMutationError=''
      isSavingGrant={false}
      isDeletingGrantId={null}
      onCreateGrant={onCreateGrant}
      onDeleteGrant={onDeleteGrant}
      {...overrides}
    />
  );

  return { onCreateGrant, onDeleteGrant };
}

describe('AssetGrantsPanel', () => {
  it('shows selection guidance when no asset is selected', () => {
    renderPanel({ selectedAsset: null });

    expect(
      screen.getByText('Select an asset to review and manage access grants.')
    ).toBeInTheDocument();
  });

  it('requires grantee for organization and user grant types', async () => {
    const user = userEvent.setup();
    const { onCreateGrant } = renderPanel();

    const grantTypeSelect = screen.getByLabelText('Grant type *');
    await user.selectOptions(grantTypeSelect, 'organization');
    expect((grantTypeSelect as HTMLSelectElement).value).toBe('organization');
    expect(screen.getByLabelText('Grantee ID *')).toBeRequired();

    await user.click(screen.getByRole('button', { name: 'Add grant' }));
    expect(onCreateGrant).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Grantee ID *'), 'org-42');
    await user.click(screen.getByRole('button', { name: 'Add grant' }));

    expect(onCreateGrant).toHaveBeenCalledWith('asset-1', {
      grantType: 'organization',
      granteeId: 'org-42',
    });
  });

  it('confirms revoke action before deleting a grant', async () => {
    const user = userEvent.setup();
    const { onDeleteGrant } = renderPanel({ grants: [GRANT] });

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    expect(onDeleteGrant).toHaveBeenCalledWith('asset-1', 'grant-1');
  });
});
