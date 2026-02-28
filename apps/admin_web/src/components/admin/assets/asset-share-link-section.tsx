'use client';

import { useEffect, useRef, useState } from 'react';

import type { AdminAsset } from '@/types/assets';

import {
  getAdminAssetShareLink,
  getOrCreateAdminAssetShareLink,
  revokeAdminAssetShareLink,
  rotateAdminAssetShareLink,
} from '@/lib/assets-api';

import { CopyIcon, DeleteIcon, RotateIcon } from '@/components/icons/action-icons';
import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_ALLOWED_SHARE_DOMAINS = '';

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

export function AssetShareLinkSection({ selectedAsset }: { selectedAsset: AdminAsset }) {
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

  useEffect(
    () => () => {
      if (copiedStateTimeoutRef.current !== null) {
        window.clearTimeout(copiedStateTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    let isCancelled = false;

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
  }, [selectedAsset.id]);

  const buildSharePolicyInput = () => ({
    allowedDomains: parseAllowedDomainList(allowedDomainsInput),
  });

  const handleCopyAssetLink = async () => {
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
      setLinkError(error instanceof Error ? error.message : 'Unable to copy the link to clipboard.');
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleRotateAssetLink = async () => {
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
      setLinkError(error instanceof Error ? error.message : 'Unable to rotate and copy the share link.');
    } finally {
      setIsRotatingLink(false);
    }
  };

  const handleSaveLinkPolicy = async () => {
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
    <div className='space-y-3'>
      {linkError ? (
        <StatusBanner variant='error' title='Asset link'>
          {linkError}
        </StatusBanner>
      ) : null}
      {linkNotice ? <StatusBanner variant='success'>{linkNotice}</StatusBanner> : null}

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
          placeholder='example.com'
        />
        <p className='text-xs text-slate-600'>
          One domain per line (or comma-separated). Share links resolve only when Referer/Origin
          matches one of these domains.
        </p>
      </div>
    </div>
  );
}
