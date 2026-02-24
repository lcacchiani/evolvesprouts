'use client';

import { useMemo, useState, type FormEvent } from 'react';

import type { AdminAsset, AssetVisibility } from '@/types/assets';

import { ASSET_VISIBILITIES } from '@/types/assets';

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
  uploadState: 'idle' | 'uploading' | 'failed' | 'succeeded';
  uploadError: string;
  hasPendingUpload: boolean;
  onRetryUpload: () => Promise<void>;
  onCreate: (payload: {
    title: string;
    description: string | null;
    fileName: string;
    fileSizeBytes: number | null;
    visibility: AssetVisibility;
  }, file: File) => Promise<void>;
  onUpdate: (
    assetId: string,
    payload: {
      title: string;
      description: string | null;
      fileName: string;
      fileSizeBytes: number | null;
      visibility: AssetVisibility;
    }
  ) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
  onStartCreate: () => void;
}

interface AssetFormState {
  title: string;
  description: string;
  visibility: AssetVisibility;
}

const EMPTY_ASSET_FORM: AssetFormState = {
  title: '',
  description: '',
  visibility: 'restricted',
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
    visibility: asset.visibility,
  };
}

export function AssetEditorPanel({
  selectedAsset,
  isSavingAsset,
  isDeletingCurrentAsset,
  assetMutationError,
  uploadState,
  uploadError,
  hasPendingUpload,
  onRetryUpload,
  onCreate,
  onUpdate,
  onDelete,
  onStartCreate,
}: AssetEditorPanelProps) {
  const [formState, setFormState] = useState<AssetFormState>(() =>
    selectedAsset ? toFormState(selectedAsset) : EMPTY_ASSET_FORM
  );
  const [formError, setFormError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isEditMode = Boolean(selectedAsset);

  const cardTitle = isEditMode ? 'Edit asset' : 'Create asset';
  const cardDescription = isEditMode
    ? 'Update metadata and visibility for the selected asset.'
    : 'Create a new PDF asset and upload content automatically with a presigned URL.';

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
    if (!title) {
      setFormError('Title is required.');
      return;
    }

    if (!isEditMode && !selectedFile) {
      setFormError('Select a PDF file to upload.');
      return;
    }

    if (selectedFile) {
      const isPdfMime = !selectedFile.type || selectedFile.type === 'application/pdf';
      const isPdfExtension = selectedFile.name.toLowerCase().endsWith('.pdf');
      if (!isPdfMime || !isPdfExtension) {
        setFormError('Only PDF files are allowed.');
        return;
      }
    }

    const payload: {
      title: string;
      description: string | null;
      fileName: string;
      fileSizeBytes: number | null;
      visibility: AssetVisibility;
    } = {
      title,
      description: formState.description.trim() || null,
      fileName: selectedFile?.name || selectedAsset?.fileName || 'document.pdf',
      fileSizeBytes: selectedFile?.size ?? selectedAsset?.fileSizeBytes ?? null,
      visibility: formState.visibility,
    };

    if (selectedAsset) {
      await onUpdate(selectedAsset.id, payload);
      return;
    }

    await onCreate(payload, selectedFile);
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
              setSelectedFile(null);
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

      {uploadState === 'uploading' ? (
        <StatusBanner variant='info' title='Uploading'>
          Uploading PDF content to S3...
        </StatusBanner>
      ) : null}

      {uploadState === 'succeeded' ? (
        <StatusBanner variant='success' title='Upload complete'>
          PDF content uploaded successfully.
        </StatusBanner>
      ) : null}

      {uploadState === 'failed' ? (
        <StatusBanner variant='error' title='Upload failed'>
          {uploadError || 'The PDF upload failed.'}
          {hasPendingUpload ? (
            <button
              type='button'
              className='ml-2 text-xs underline underline-offset-2'
              onClick={() => void onRetryUpload()}
            >
              Retry upload
            </button>
          ) : null}
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
          {!isEditMode ? (
            <div className='space-y-2'>
              <Label htmlFor='asset-file-upload'>PDF file</Label>
              <Input
                id='asset-file-upload'
                type='file'
                accept='application/pdf,.pdf'
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
                required
              />
              <p className='text-xs text-slate-600'>
                Asset type is fixed to Document (PDF), content type is applied as
                application/pdf.
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              <Label>File</Label>
              <p className='rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700'>
                {selectedAsset?.fileName || '—'}
              </p>
              <p className='text-xs text-slate-600'>File replacement is not supported in edit mode.</p>
            </div>
          )}
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
