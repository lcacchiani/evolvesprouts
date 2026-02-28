import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetAdminAssetShareLink,
  mockGetOrCreateAdminAssetShareLink,
  mockRotateAdminAssetShareLink,
  mockRevokeAdminAssetShareLink,
} = vi.hoisted(() => ({
  mockGetAdminAssetShareLink: vi.fn(),
  mockGetOrCreateAdminAssetShareLink: vi.fn(),
  mockRotateAdminAssetShareLink: vi.fn(),
  mockRevokeAdminAssetShareLink: vi.fn(),
}));

vi.mock('@/lib/assets-api', () => ({
  getAdminAssetShareLink: mockGetAdminAssetShareLink,
  getOrCreateAdminAssetShareLink: mockGetOrCreateAdminAssetShareLink,
  rotateAdminAssetShareLink: mockRotateAdminAssetShareLink,
  revokeAdminAssetShareLink: mockRevokeAdminAssetShareLink,
}));

import { AssetEditorPanel } from '@/components/admin/assets/asset-editor-panel';
import { createAdminAssetFixture } from '../../../fixtures/assets';

const SELECTED_ASSET = createAdminAssetFixture({
  description: 'Original description',
});

function renderEditor(overrides: Partial<ComponentProps<typeof AssetEditorPanel>> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onStartCreate = vi.fn();
  const onRetryUpload = vi.fn().mockResolvedValue(undefined);

  render(
    <AssetEditorPanel
      selectedAsset={null}
      isSavingAsset={false}
      isDeletingCurrentAsset={false}
      assetMutationError=''
      uploadState='idle'
      uploadError=''
      hasPendingUpload={false}
      onRetryUpload={onRetryUpload}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onStartCreate={onStartCreate}
      {...overrides}
    />
  );

  return { onCreate, onUpdate, onStartCreate, onRetryUpload };
}

describe('AssetEditorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminAssetShareLink.mockResolvedValue({
      assetId: 'asset-1',
      shareUrl: 'https://share.example.com/a',
      allowedDomains: ['example.com'],
    });
    mockGetOrCreateAdminAssetShareLink.mockResolvedValue({
      assetId: 'asset-1',
      shareUrl: 'https://share.example.com/a',
      allowedDomains: ['example.com'],
    });
    mockRotateAdminAssetShareLink.mockResolvedValue({
      assetId: 'asset-1',
      shareUrl: 'https://share.example.com/b',
      allowedDomains: ['example.com'],
    });
    mockRevokeAdminAssetShareLink.mockResolvedValue(undefined);
  });

  it('validates create form and enforces PDF uploads', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderEditor();

    await user.type(screen.getByLabelText('Title *'), 'New guide');
    await user.click(screen.getByRole('button', { name: 'Create asset' }));

    expect(screen.getByText('Select a PDF file to upload.')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();

    const fileInput = screen.getByLabelText('Upload PDF file');
    const invalidPdfFile = new File(['hello'], 'notes.pdf', { type: 'text/plain' });
    await user.upload(fileInput, invalidPdfFile);
    await user.click(screen.getByRole('button', { name: 'Create asset' }));

    expect(screen.getByText('Only PDF files are allowed.')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits update payload in edit mode', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderEditor({ selectedAsset: SELECTED_ASSET });

    const titleInput = screen.getByLabelText('Title *');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('asset-1', {
        title: 'Updated title',
        description: 'Original description',
        fileName: 'infant-guide.pdf',
        visibility: 'restricted',
      });
    });
  });

  it('runs copy, rotate, and revoke share-link actions', async () => {
    const user = userEvent.setup();
    renderEditor({ selectedAsset: SELECTED_ASSET });

    await waitFor(() => {
      expect(mockGetAdminAssetShareLink).toHaveBeenCalledWith('asset-1');
    });

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(mockGetOrCreateAdminAssetShareLink).toHaveBeenCalledWith('asset-1', {
        allowedDomains: ['example.com'],
      });
    });

    await user.click(screen.getByRole('button', { name: 'Rotate link' }));
    await user.click(screen.getByRole('button', { name: 'Rotate' }));
    await waitFor(() => {
      expect(mockRotateAdminAssetShareLink).toHaveBeenCalledWith('asset-1', {
        allowedDomains: ['example.com'],
      });
    });

    await user.click(screen.getByRole('button', { name: 'Delete link' }));
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(mockRevokeAdminAssetShareLink).toHaveBeenCalledWith('asset-1');
    });
  });
});
