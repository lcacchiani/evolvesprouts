'use client';

import { useMemo, useState, type FormEvent } from 'react';

import type {
  AdminAsset,
  AdminAssetWriteContentLanguage,
  AssetVisibility,
  UpdateAdminAssetPatchInput,
} from '@/types/assets';

import {
  matchAdminSelectableContentLanguage,
  toTitleCase,
} from '@/lib/format';
import {
  ASSET_VISIBILITIES,
  CLIENT_DOCUMENT_ASSET_TAG,
  EXPENSE_ATTACHMENT_ASSET_TAG,
} from '@/types/assets';

import { AssetShareLinkSection } from '@/components/admin/assets/asset-share-link-section';
import { StatusBanner } from '@/components/status-banner';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';
import { ContentLanguageSelect } from '@/components/ui/content-language-select';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const ASSET_EDITOR_FORM_ID = 'admin-asset-editor-form';

interface AssetEditorPanelProps {
  selectedAsset: AdminAsset | null;
  isSavingAsset: boolean;
  isDeletingCurrentAsset: boolean;
  assetMutationError: string;
  uploadState: 'idle' | 'uploading' | 'failed' | 'succeeded';
  uploadError: string;
  hasPendingUpload: boolean;
  onRetryUpload: () => Promise<void>;
  onCreate: (
    payload: {
      title: string;
      description: string | null;
      fileName: string;
      resourceKey: string | null;
      visibility: AssetVisibility;
      contentLanguage: AdminAssetWriteContentLanguage | null;
      clientTag: typeof CLIENT_DOCUMENT_ASSET_TAG | null;
    },
    file: File
  ) => Promise<void>;
  onUpdate: (assetId: string, payload: UpdateAdminAssetPatchInput) => Promise<void>;
  onStartCreate: () => void;
}

interface AssetFormState {
  title: string;
  description: string;
  resourceKey: string;
  visibility: AssetVisibility;
  /** BCP 47 tag or empty when unset / unknown legacy value */
  contentLanguage: string;
  /** Select value: empty string = no client tag; client_document = Client */
  clientTag: '' | typeof CLIENT_DOCUMENT_ASSET_TAG;
}

const EMPTY_ASSET_FORM: AssetFormState = {
  title: '',
  description: '',
  resourceKey: '',
  visibility: 'restricted',
  contentLanguage: '',
  clientTag: '',
};

const RESOURCE_KEY_MAX_LENGTH = 64;

function assetHasClientDocumentTag(asset: AdminAsset): boolean {
  return asset.tags.some((t) => t.name.toLowerCase() === CLIENT_DOCUMENT_ASSET_TAG);
}

function toContentLanguageSelectValue(asset: AdminAsset): string {
  const match = matchAdminSelectableContentLanguage(asset.contentLanguage);
  return match && match !== 'unrecognized' ? match : '';
}

function canonicalContentLanguageFromApi(value: string | null | undefined): string | null {
  const match = matchAdminSelectableContentLanguage(value);
  if (match === 'unrecognized') {
    return null;
  }
  return match;
}

function toFormState(asset: AdminAsset): AssetFormState {
  return {
    title: asset.title,
    description: asset.description ?? '',
    resourceKey: asset.resourceKey ?? '',
    visibility: asset.visibility,
    contentLanguage: toContentLanguageSelectValue(asset),
    clientTag: assetHasClientDocumentTag(asset) ? CLIENT_DOCUMENT_ASSET_TAG : '',
  };
}

function normalizeResourceKey(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, RESOURCE_KEY_MAX_LENGTH)
    .replaceAll(/-+$/g, '');
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
  onStartCreate,
}: AssetEditorPanelProps) {
  const [formState, setFormState] = useState<AssetFormState>(() =>
    selectedAsset ? toFormState(selectedAsset) : EMPTY_ASSET_FORM
  );
  const [formError, setFormError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isEditMode = Boolean(selectedAsset);
  const isExpenseLinked = Boolean(
    selectedAsset?.tags.some((t) => t.name.toLowerCase() === EXPENSE_ATTACHMENT_ASSET_TAG)
  );

  const cardTitle = isEditMode ? 'Edit Asset' : 'Create Asset';
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

    const fileToUpload = selectedFile;
    if (!isEditMode && !fileToUpload) {
      setFormError('Select a PDF file to upload.');
      return;
    }

    if (fileToUpload) {
      const isPdfMime = !fileToUpload.type || fileToUpload.type === 'application/pdf';
      const isPdfExtension = fileToUpload.name.toLowerCase().endsWith('.pdf');
      if (!isPdfMime || !isPdfExtension) {
        setFormError('Only PDF files are allowed.');
        return;
      }
    }

    const normalizedResourceKey = normalizeResourceKey(formState.resourceKey);
    if (formState.resourceKey.trim() && !normalizedResourceKey) {
      setFormError('Resource key must include letters or numbers.');
      return;
    }
    const resourceKey = normalizedResourceKey || null;

    const contentLanguageTrimmed = formState.contentLanguage.trim();
    let contentLanguage: AdminAssetWriteContentLanguage | null = null;
    if (contentLanguageTrimmed !== '') {
      const matched = matchAdminSelectableContentLanguage(contentLanguageTrimmed);
      if (matched === 'unrecognized') {
        setFormError('Invalid language selection.');
        return;
      }
      contentLanguage = matched;
    }

    const clientTagValue: typeof CLIENT_DOCUMENT_ASSET_TAG | null =
      formState.clientTag === CLIENT_DOCUMENT_ASSET_TAG ? CLIENT_DOCUMENT_ASSET_TAG : null;

    if (isEditMode && selectedAsset) {
      const storedLang = matchAdminSelectableContentLanguage(selectedAsset.contentLanguage);
      if (storedLang === 'unrecognized') {
        setFormError(
          'This asset has a language value that is not supported in the admin list. Contact engineering before saving, or the value will be cleared.'
        );
        return;
      }

      const nextDescription = formState.description.trim() || null;
      const patch: UpdateAdminAssetPatchInput = {};
      if (title !== selectedAsset.title) {
        patch.title = title;
      }
      if (nextDescription !== (selectedAsset.description ?? null)) {
        patch.description = nextDescription;
      }
      if (resourceKey !== (selectedAsset.resourceKey ?? null)) {
        patch.resourceKey = resourceKey;
      }
      if (formState.visibility !== selectedAsset.visibility) {
        patch.visibility = formState.visibility;
      }
      const nextLang = contentLanguage;
      const prevLangCanonical = canonicalContentLanguageFromApi(selectedAsset.contentLanguage);
      if (nextLang !== prevLangCanonical) {
        patch.contentLanguage = nextLang;
      }
      if (!isExpenseLinked) {
        const hadClient = assetHasClientDocumentTag(selectedAsset);
        const nextHasClient = clientTagValue === CLIENT_DOCUMENT_ASSET_TAG;
        if (hadClient !== nextHasClient) {
          patch.clientTag = clientTagValue;
        }
      }
      if (Object.keys(patch).length > 0) {
        await onUpdate(selectedAsset.id, patch);
      }
      return;
    }

    const core = {
      title,
      description: formState.description.trim() || null,
      fileName: fileToUpload?.name || selectedAsset?.fileName || 'document.pdf',
      resourceKey,
      visibility: formState.visibility,
      contentLanguage,
    };

    if (!fileToUpload) {
      setFormError('Select a PDF file to upload.');
      return;
    }
    await onCreate({ ...core, clientTag: clientTagValue }, fileToUpload);
  };

  const handleCancel = () => {
    onStartCreate();
    setFormState(EMPTY_ASSET_FORM);
    setSelectedFile(null);
    setFormError('');
  };

  return (
    <AdminEditorCard
      title={cardTitle}
      description={cardDescription}
      actions={
        <>
          {isEditMode ? (
            <Button
              type='button'
              variant='secondary'
              onClick={handleCancel}
              disabled={isSavingAsset || isDeletingCurrentAsset}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type='submit'
            form={ASSET_EDITOR_FORM_ID}
            disabled={isSavingAsset}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
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

      <form id={ASSET_EDITOR_FORM_ID} onSubmit={handleSubmit} className='space-y-4'>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='asset-title'>Title *</Label>
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
            <Label htmlFor='asset-visibility'>Visibility *</Label>
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
            <Label htmlFor='asset-resource-key'>Resource key</Label>
            <Input
              id='asset-resource-key'
              value={formState.resourceKey}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  resourceKey: event.target.value,
                }))
              }
              placeholder='patience-free-guide'
            />
          </div>
          {!isEditMode ? (
            <div className='space-y-2'>
              <Label htmlFor='asset-file-upload'>PDF file *</Label>
              <FileUploadButton
                id='asset-file-upload'
                accept='application/pdf,.pdf'
                selectedFileName={selectedFile?.name ?? null}
                emptyLabel='No file chosen'
                inputAriaLabel='Upload PDF file'
                disabled={isSavingAsset}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />
            </div>
          ) : selectedAsset ? (
            <AssetShareLinkSection selectedAsset={selectedAsset} />
          ) : null}
          {isEditMode && selectedAsset ? (
            <div className='space-y-2 lg:col-span-2'>
              <Label htmlFor='asset-file-name'>File</Label>
              <Input id='asset-file-name' value={selectedAsset.fileName || '—'} disabled readOnly />
              <p className='text-xs text-slate-600'>File replacement is not supported in edit mode.</p>
            </div>
          ) : null}
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end'>
          <div className='space-y-2'>
            <Label htmlFor='asset-tag'>Tag</Label>
            {isEditMode && isExpenseLinked ? (
              <Select
                id='asset-tag'
                value='expense'
                disabled
                aria-label='Tag (linked to expense; not editable)'
                title='Tags cannot be changed for assets linked to an expense.'
              >
                <option value='expense'>Expense</option>
              </Select>
            ) : (
              <Select
                id='asset-tag'
                value={formState.clientTag}
                disabled={isSavingAsset}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    clientTag:
                      event.target.value === CLIENT_DOCUMENT_ASSET_TAG
                        ? CLIENT_DOCUMENT_ASSET_TAG
                        : '',
                  }))
                }
              >
                <option value=''>No tag</option>
                <option value={CLIENT_DOCUMENT_ASSET_TAG}>Client</option>
              </Select>
            )}
          </div>
          <ContentLanguageSelect
            id='asset-content-language'
            label='Language'
            value={formState.contentLanguage}
            disabled={isSavingAsset}
            onChange={(next) =>
              setFormState((previous) => ({ ...previous, contentLanguage: next }))
            }
          />
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
      </form>
    </AdminEditorCard>
  );
}
