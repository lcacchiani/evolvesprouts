'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type { AdminAsset, AssetVisibility } from '@/types/assets';

import {
  getAdminAssetShareLink,
  getOrCreateAdminAssetShareLink,
  revokeAdminAssetShareLink,
  rotateAdminAssetShareLink,
} from '@/lib/assets-api';
import { ASSET_VISIBILITIES } from '@/types/assets';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileUploadButton } from '@/components/ui/file-upload-button';
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
    visibility: AssetVisibility;
  }, file: File) => Promise<void>;
  onUpdate: (
    assetId: string,
    payload: {
      title: string;
      description: string | null;
      fileName: string;
      visibility: AssetVisibility;
    }
  ) => Promise<void>;
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
const DEFAULT_ALLOWED_SHARE_DOMAINS = 'www.evolvesprouts.com';

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

function parseAllowedDomainList(input: string): string[] {
  const rawEntries = input
    .split(/[\n,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  const uniqueEntries = Array.from(new Set(rawEntries));
  if (uniqueEntries.length === 0) {
    throw new Error('Add at least one allowed domain before creating or rotating a share link.');
  }
  return uniqueEntries;
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <rect x='9' y='9' width='13' height='13' rx='2' />
      <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
    </svg>
  );
}

function RotateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <polyline points='23 4 23 10 17 10' />
      <polyline points='1 20 1 14 7 14' />
      <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10' />
      <path d='M20.49 15a9 9 0 0 1-14.85 3.36L1 14' />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <polyline points='3 6 5 6 21 6' />
      <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
      <line x1='10' y1='11' x2='10' y2='17' />
      <line x1='14' y1='11' x2='14' y2='17' />
    </svg>
  );
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
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [isRotatingLink, setIsRotatingLink] = useState(false);
  const [isRevokingLink, setIsRevokingLink] = useState(false);
  const [isSavingLinkPolicy, setIsSavingLinkPolicy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkNotice, setLinkNotice] = useState('');
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [allowedDomainsInput, setAllowedDomainsInput] = useState<string>(
    DEFAULT_ALLOWED_SHARE_DOMAINS
  );
  const copiedStateTimeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (copiedStateTimeoutRef.current !== null) {
        window.clearTimeout(copiedStateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    if (!selectedAsset) {
      setAllowedDomainsInput(DEFAULT_ALLOWED_SHARE_DOMAINS);
      return () => {
        isCancelled = true;
      };
    }

    const loadShareLinkPolicy = async () => {
      try {
        const existingShareLink = await getAdminAssetShareLink(selectedAsset.id);
        if (isCancelled) {
          return;
        }
        if (existingShareLink?.allowedDomains.length) {
          setAllowedDomainsInput(existingShareLink.allowedDomains.join('\n'));
        } else {
          setAllowedDomainsInput(DEFAULT_ALLOWED_SHARE_DOMAINS);
        }
      } catch {
        if (isCancelled) {
          return;
        }
        setAllowedDomainsInput(DEFAULT_ALLOWED_SHARE_DOMAINS);
      }
    };

    void loadShareLinkPolicy();
    return () => {
      isCancelled = true;
    };
  }, [selectedAsset]);

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

    const payload: {
      title: string;
      description: string | null;
      fileName: string;
      visibility: AssetVisibility;
    } = {
      title,
      description: formState.description.trim() || null,
      fileName: fileToUpload?.name || selectedAsset?.fileName || 'document.pdf',
      visibility: formState.visibility,
    };

    if (isEditMode && selectedAsset) {
      await onUpdate(selectedAsset.id, payload);
      return;
    }

    if (!fileToUpload) {
      setFormError('Select a PDF file to upload.');
      return;
    }
    await onCreate(payload, fileToUpload);
  };

  const handleCancel = () => {
    onStartCreate();
    setFormState(EMPTY_ASSET_FORM);
    setSelectedFile(null);
    setFormError('');
    setLinkError('');
    setLinkNotice('');
    setIsLinkCopied(false);
    setIsCopyingLink(false);
    setIsRotatingLink(false);
    setIsRevokingLink(false);
    setIsSavingLinkPolicy(false);
    setAllowedDomainsInput(DEFAULT_ALLOWED_SHARE_DOMAINS);
    if (copiedStateTimeoutRef.current !== null) {
      window.clearTimeout(copiedStateTimeoutRef.current);
      copiedStateTimeoutRef.current = null;
    }
  };

  const buildSharePolicyInput = () => ({
    allowedDomains: parseAllowedDomainList(allowedDomainsInput),
  });

  const handleCopyAssetLink = async () => {
    if (!selectedAsset) {
      return;
    }

    setIsCopyingLink(true);
    setLinkError('');
    setLinkNotice('');
    setIsLinkCopied(false);
    try {
      const policyInput = buildSharePolicyInput();
      const link = await getOrCreateAdminAssetShareLink(selectedAsset.id, policyInput);
      await navigator.clipboard.writeText(link.shareUrl);
      if (link.allowedDomains.length > 0) {
        setAllowedDomainsInput(link.allowedDomains.join('\n'));
      }
      setLinkError('');
      setLinkNotice('Share link copied to clipboard.');
      setIsLinkCopied(true);
      if (copiedStateTimeoutRef.current !== null) {
        window.clearTimeout(copiedStateTimeoutRef.current);
      }
      copiedStateTimeoutRef.current = window.setTimeout(() => {
        setIsLinkCopied(false);
        copiedStateTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      setLinkError(
        error instanceof Error ? error.message : 'Unable to copy the link to clipboard.'
      );
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleRotateAssetLink = async () => {
    if (!selectedAsset) {
      return;
    }

    const confirmed = window.confirm(
      'Rotate this share link? Previously copied links will stop working.'
    );
    if (!confirmed) {
      return;
    }

    setIsRotatingLink(true);
    setLinkError('');
    setLinkNotice('');
    setIsLinkCopied(false);
    try {
      const policyInput = buildSharePolicyInput();
      const link = await rotateAdminAssetShareLink(selectedAsset.id, policyInput);
      await navigator.clipboard.writeText(link.shareUrl);
      if (link.allowedDomains.length > 0) {
        setAllowedDomainsInput(link.allowedDomains.join('\n'));
      }
      setLinkNotice('Share link rotated and copied. Previous links are revoked.');
      setIsLinkCopied(true);
      if (copiedStateTimeoutRef.current !== null) {
        window.clearTimeout(copiedStateTimeoutRef.current);
      }
      copiedStateTimeoutRef.current = window.setTimeout(() => {
        setIsLinkCopied(false);
        copiedStateTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      setLinkError(
        error instanceof Error ? error.message : 'Unable to rotate and copy the share link.'
      );
    } finally {
      setIsRotatingLink(false);
    }
  };

  const handleSaveLinkPolicy = async () => {
    if (!selectedAsset) {
      return;
    }

    setIsSavingLinkPolicy(true);
    setLinkError('');
    setLinkNotice('');
    setIsLinkCopied(false);
    try {
      const policyInput = buildSharePolicyInput();
      const link = await getOrCreateAdminAssetShareLink(selectedAsset.id, policyInput);
      if (link.allowedDomains.length > 0) {
        setAllowedDomainsInput(link.allowedDomains.join('\n'));
      }
      setLinkNotice('Share-link domain policy saved.');
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Unable to save link domain policy.');
    } finally {
      setIsSavingLinkPolicy(false);
    }
  };

  const handleRevokeAssetLink = async () => {
    if (!selectedAsset) {
      return;
    }

    const confirmed = window.confirm(
      'Revoke this share link? Anyone with the current link will lose access.'
    );
    if (!confirmed) {
      return;
    }

    setIsRevokingLink(true);
    setLinkError('');
    setLinkNotice('');
    setIsLinkCopied(false);
    try {
      await revokeAdminAssetShareLink(selectedAsset.id);
      if (copiedStateTimeoutRef.current !== null) {
        window.clearTimeout(copiedStateTimeoutRef.current);
        copiedStateTimeoutRef.current = null;
      }
      setLinkNotice('Share link revoked.');
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Unable to revoke the share link.');
    } finally {
      setIsRevokingLink(false);
    }
  };

  const areLinkButtonsDisabled =
    isCopyingLink || isRotatingLink || isRevokingLink || isSavingLinkPolicy;

  return (
    <Card title={cardTitle} description={cardDescription} className='space-y-4'>
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

      {linkError ? (
        <StatusBanner variant='error' title='Asset link'>
          {linkError}
        </StatusBanner>
      ) : null}
      {linkNotice ? (
        <StatusBanner variant='success'>
          {linkNotice}
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
          ) : (
            <div className='space-y-2 lg:col-span-2'>
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'>
                <div className='space-y-2'>
                  <Label htmlFor='asset-file-name'>File</Label>
                  <Input
                    id='asset-file-name'
                    value={selectedAsset?.fileName || '—'}
                    disabled
                    readOnly
                  />
                  <p className='text-xs text-slate-600'>
                    File replacement is not supported in edit mode.
                  </p>
                </div>
                <div className='space-y-2'>
                  <Label>Links</Label>
                  <div className='flex items-center gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      className='h-9 w-9 p-0'
                      onClick={() => void handleCopyAssetLink()}
                      disabled={areLinkButtonsDisabled}
                      title={isCopyingLink ? 'Copying link' : isLinkCopied ? 'Link copied' : 'Copy link'}
                      aria-label={isCopyingLink ? 'Copying link' : isLinkCopied ? 'Link copied' : 'Copy link'}
                    >
                      <CopyIcon className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className='h-9 w-9 p-0'
                      onClick={() => void handleRotateAssetLink()}
                      disabled={areLinkButtonsDisabled}
                      title={isRotatingLink ? 'Rotating link' : 'Rotate link'}
                      aria-label={isRotatingLink ? 'Rotating link' : 'Rotate link'}
                    >
                      <RotateIcon className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      className='h-9 w-9 p-0'
                      onClick={() => void handleRevokeAssetLink()}
                      disabled={areLinkButtonsDisabled}
                      title={isRevokingLink ? 'Revoking link' : 'Delete link'}
                      aria-label={isRevokingLink ? 'Revoking link' : 'Delete link'}
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
              <div className='space-y-2'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <Label htmlFor='asset-share-allowed-domains'>Share-link domain allowlist</Label>
                  <Button
                    type='button'
                    size='sm'
                    variant='secondary'
                    onClick={() => void handleSaveLinkPolicy()}
                    disabled={areLinkButtonsDisabled}
                    title={isSavingLinkPolicy ? 'Saving policy' : 'Save domain policy'}
                    aria-label={isSavingLinkPolicy ? 'Saving policy' : 'Save domain policy'}
                  >
                    Save policy
                  </Button>
                </div>
                <Textarea
                  id='asset-share-allowed-domains'
                  rows={3}
                  value={allowedDomainsInput}
                  onChange={(event) => setAllowedDomainsInput(event.target.value)}
                  placeholder='www.evolvesprouts.com'
                />
                <p className='text-xs text-slate-600'>
                  One domain per line (or comma-separated). Share links resolve only when
                  Referer/Origin matches one of these domains.
                </p>
              </div>
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
              variant='secondary'
              onClick={handleCancel}
              disabled={isSavingAsset || isDeletingCurrentAsset}
            >
              Cancel
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
