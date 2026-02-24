'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { AdminAsset, AssetType, AssetVisibility, CreatedAssetUpload } from '@/types/assets';

import { ASSET_TYPES, ASSET_VISIBILITIES } from '@/types/assets';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface AssetEditorPanelProps {
  selectedAsset: AdminAsset | null;
  isSavingAsset: boolean;
  isDeletingCurrentAsset: boolean;
  assetMutationError: string;
  lastCreatedUpload: CreatedAssetUpload | null;
  onCreate: (payload: {
    title: string;
    description: string | null;
    assetType: AssetType;
    fileName: string;
    contentType: string | null;
    fileSizeBytes: number | null;
    visibility: AssetVisibility;
    organizationId: string | null;
  }) => Promise<void>;
  onUpdate: (
    assetId: string,
    payload: {
      title: string;
      description: string | null;
      assetType: AssetType;
      fileName: string;
      contentType: string | null;
      fileSizeBytes: number | null;
      visibility: AssetVisibility;
      organizationId: string | null;
    }
  ) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
  onStartCreate: () => void;
  onDismissUploadNotice: () => void;
}

interface AssetFormState {
  title: string;
  description: string;
  assetType: AssetType;
  fileName: string;
  contentType: string;
  fileSizeBytes: string;
  visibility: AssetVisibility;
  organizationId: string;
}

const EMPTY_ASSET_FORM: AssetFormState = {
  title: '',
  description: '',
  assetType: 'guide',
  fileName: '',
  contentType: '',
  fileSizeBytes: '',
  visibility: 'restricted',
  organizationId: '',
};

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toFormState(asset: AdminAsset): AssetFormState {
  return {
    title: asset.title,
    description: asset.description ?? '',
    assetType: asset.assetType,
    fileName: asset.fileName,
    contentType: asset.contentType ?? '',
    fileSizeBytes: asset.fileSizeBytes !== null ? `${asset.fileSizeBytes}` : '',
    visibility: asset.visibility,
    organizationId: asset.organizationId ?? '',
  };
}

export function AssetEditorPanel({
  selectedAsset,
  isSavingAsset,
  isDeletingCurrentAsset,
  assetMutationError,
  lastCreatedUpload,
  onCreate,
  onUpdate,
  onDelete,
  onStartCreate,
  onDismissUploadNotice,
}: AssetEditorPanelProps) {
  const [formState, setFormState] = useState<AssetFormState>(EMPTY_ASSET_FORM);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!selectedAsset) {
      setFormState(EMPTY_ASSET_FORM);
      return;
    }
    setFormState(toFormState(selectedAsset));
  }, [selectedAsset]);

  const isEditMode = Boolean(selectedAsset);

  const cardTitle = isEditMode ? 'Edit asset' : 'Create asset';
  const cardDescription = isEditMode
    ? 'Update metadata and visibility for the selected asset.'
    : 'Create a new asset record and request a presigned upload URL.';

  const submitLabel = useMemo(() => {
    if (isSavingAsset) {
      return isEditMode ? 'Saving...' : 'Creating...';
    }
    return isEditMode ? 'Save changes' : 'Create asset';
  }, [isEditMode, isSavingAsset]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const title = formState.title.trim();
    const fileName = formState.fileName.trim();
    if (!title) {
      setFormError('Title is required.');
      return;
    }
    if (!fileName) {
      setFormError('File name is required.');
      return;
    }

    let parsedFileSizeBytes: number | null = null;
    if (formState.fileSizeBytes.trim()) {
      const nextFileSize = Number(formState.fileSizeBytes);
      if (!Number.isFinite(nextFileSize) || nextFileSize < 0) {
        setFormError('File size must be a non-negative number.');
        return;
      }
      parsedFileSizeBytes = Math.floor(nextFileSize);
    }

    const payload = {
      title,
      description: formState.description.trim() || null,
      assetType: formState.assetType,
      fileName,
      contentType: formState.contentType.trim() || null,
      fileSizeBytes: parsedFileSizeBytes,
      visibility: formState.visibility,
      organizationId: formState.organizationId.trim() || null,
    };

    if (selectedAsset) {
      await onUpdate(selectedAsset.id, payload);
      return;
    }

    await onCreate(payload);
  };

  const handleDelete = async () => {
    if (!selectedAsset) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${selectedAsset.title}"? This removes the asset record and S3 object.`
    );
    if (!confirmed) {
      return;
    }

    await onDelete(selectedAsset.id);
  };

  return (
    <Card title={cardTitle} description={cardDescription} className='space-y-4'>
      <div className='flex flex-wrap items-center justify-end gap-2'>
        {isEditMode ? (
          <Button
            type='button'
            variant='ghost'
            onClick={() => {
              onStartCreate();
              setFormState(EMPTY_ASSET_FORM);
            }}
          >
            New asset
          </Button>
        ) : null}
      </div>

      {assetMutationError ? (
        <StatusBanner variant='error' title='Asset'>
          {assetMutationError}
        </StatusBanner>
      ) : null}

      {formError ? (
        <StatusBanner variant='error' title='Validation'>
          {formError}
        </StatusBanner>
      ) : null}

      {lastCreatedUpload?.uploadUrl ? (
        <StatusBanner variant='success' title='Upload URL ready'>
          <span className='break-all'>{lastCreatedUpload.uploadUrl}</span>
          <button
            type='button'
            className='ml-2 text-xs underline underline-offset-2'
            onClick={onDismissUploadNotice}
          >
            Dismiss
          </button>
        </StatusBanner>
      ) : null}

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='asset-title'>Title</Label>
            <Input
              id='asset-title'
              value={formState.title}
              onChange={(event) =>
                setFormState((previous) => ({ ...previous, title: event.target.value }))
              }
              placeholder='Infant nutrition guide'
              required
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='asset-file-name'>File name</Label>
            <Input
              id='asset-file-name'
              value={formState.fileName}
              onChange={(event) =>
                setFormState((previous) => ({ ...previous, fileName: event.target.value }))
              }
              placeholder='nutrition-guide.pdf'
              required
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='asset-type'>Asset type</Label>
            <Select
              id='asset-type'
              value={formState.assetType}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  assetType: event.target.value as AssetType,
                }))
              }
            >
              {ASSET_TYPES.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {toTitleCase(assetType)}
                </option>
              ))}
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='asset-visibility'>Visibility</Label>
            <Select
              id='asset-visibility'
              value={formState.visibility}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  visibility: event.target.value as AssetVisibility,
                }))
              }
            >
              {ASSET_VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {toTitleCase(visibility)}
                </option>
              ))}
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='asset-content-type'>Content type</Label>
            <Input
              id='asset-content-type'
              value={formState.contentType}
              onChange={(event) =>
                setFormState((previous) => ({ ...previous, contentType: event.target.value }))
              }
              placeholder='application/pdf'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='asset-size-bytes'>File size (bytes)</Label>
            <Input
              id='asset-size-bytes'
              value={formState.fileSizeBytes}
              onChange={(event) =>
                setFormState((previous) => ({ ...previous, fileSizeBytes: event.target.value }))
              }
              inputMode='numeric'
              placeholder='245760'
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='asset-description'>Description</Label>
          <Textarea
            id='asset-description'
            rows={3}
            value={formState.description}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, description: event.target.value }))
            }
            placeholder='Optional summary shown in client applications.'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='asset-organization-id'>Organization ID (optional)</Label>
          <Input
            id='asset-organization-id'
            value={formState.organizationId}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, organizationId: event.target.value }))
            }
            placeholder='UUID of organization for scoped assets'
          />
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          {isEditMode ? (
            <Button
              type='button'
              variant='danger'
              onClick={() => void handleDelete()}
              disabled={isDeletingCurrentAsset}
            >
              {isDeletingCurrentAsset ? 'Deleting...' : 'Delete asset'}
            </Button>
          ) : null}
          <Button type='submit' disabled={isSavingAsset}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
