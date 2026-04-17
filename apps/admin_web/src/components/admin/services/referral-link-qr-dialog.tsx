'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { trackAdminAnalyticsEvent } from '@/lib/admin-analytics';
import { getPublicSiteBaseUrl } from '@/lib/config';
import { generateReferralQrPngDataUrl } from '@/lib/qr-code-image';
import {
  buildMyBestAuntieReferralUrl,
  MY_BEST_AUNTIE_REFERRAL_LOCALES,
  type MyBestAuntieReferralLocale,
  type ReferralParamName,
} from '@/lib/referral-links';

const REFERRAL_SLUG = 'my-best-auntie';

export interface ReferralLinkQrDialogProps {
  open: boolean;
  onClose: () => void;
  discountCode: string;
}

export function ReferralLinkQrDialog({ open, onClose, discountCode }: ReferralLinkQrDialogProps) {
  const headingId = useId();
  const [locale, setLocale] = useState<MyBestAuntieReferralLocale>('en');
  const [paramName, setParamName] = useState<ReferralParamName>('ref');
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [renderError, setRenderError] = useState('');

  const baseUrl = useMemo(() => getPublicSiteBaseUrl(), []);
  const builtUrl = useMemo(() => {
    if (!baseUrl) {
      return '';
    }
    return buildMyBestAuntieReferralUrl({
      baseUrl,
      locale,
      code: discountCode,
      paramName,
    });
  }, [baseUrl, discountCode, locale, paramName]);

  useEffect(() => {
    if (open) {
      trackAdminAnalyticsEvent('admin_referral_qr_opened', { service_slug: REFERRAL_SLUG });
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!open || !builtUrl) {
        setPreviewDataUrl('');
        setRenderError('');
        setIsRenderingPreview(false);
        return;
      }
      setIsRenderingPreview(true);
      setRenderError('');
      void generateReferralQrPngDataUrl({
        url: builtUrl,
        size: 220,
        logoSrc: `${typeof window !== 'undefined' ? window.location.origin : ''}/evolvesprouts-logo.svg`,
      })
        .then((dataUrl) => {
          if (!cancelled) {
            setPreviewDataUrl(dataUrl);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRenderError('Could not render QR preview.');
            setPreviewDataUrl('');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsRenderingPreview(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [builtUrl, open]);

  async function copyUrl() {
    if (!builtUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(builtUrl);
    trackAdminAnalyticsEvent('admin_referral_qr_copied', { service_slug: REFERRAL_SLUG });
  }

  async function downloadPng(size: number) {
    if (!builtUrl) {
      return;
    }
    const dataUrl = await generateReferralQrPngDataUrl({
      url: builtUrl,
      size,
      logoSrc: `${window.location.origin}/evolvesprouts-logo.svg`,
    });
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `referral-${discountCode.trim().toUpperCase()}-${size}.png`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    trackAdminAnalyticsEvent('admin_referral_qr_downloaded', {
      service_slug: REFERRAL_SLUG,
      png_size_px: size,
    });
  }

  const configError = !baseUrl.trim()
    ? 'Set NEXT_PUBLIC_PUBLIC_SITE_BASE_URL to generate referral links.'
    : '';

  const previewAriaLabel = `QR code preview for referral link to ${REFERRAL_SLUG}`;

  return (
    <ConfirmDialog
      open={open}
      title='Referral link and QR'
      description='Share this link or QR for the My Best Auntie course page. Locale is included in the URL for consistent scanning.'
      cancelLabel='Close'
      confirmLabel='Close'
      hideConfirm
      dialogRole='dialog'
      onCancel={onClose}
      onConfirm={onClose}
    >
      <div className='space-y-4' aria-labelledby={headingId}>
        {configError ? <p className='text-sm text-red-600'>{configError}</p> : null}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div>
            <Label htmlFor='referral-locale'>Locale</Label>
            <Select
              id='referral-locale'
              value={locale}
              onChange={(event) => setLocale(event.target.value as MyBestAuntieReferralLocale)}
              disabled={Boolean(configError)}
            >
              {MY_BEST_AUNTIE_REFERRAL_LOCALES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='referral-param'>URL parameter</Label>
            <Select
              id='referral-param'
              value={paramName}
              onChange={(event) => setParamName(event.target.value as ReferralParamName)}
              disabled={Boolean(configError)}
            >
              <option value='ref'>ref</option>
              <option value='discount'>discount</option>
            </Select>
          </div>
        </div>
        <div className='space-y-2'>
          <Label>Preview URL</Label>
          <div className='flex flex-wrap items-center gap-2'>
            <code className='max-w-full flex-1 break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-800'>
              {builtUrl || '—'}
            </code>
            <Button
              type='button'
              size='sm'
              variant='secondary'
              disabled={!builtUrl}
              onClick={() => void copyUrl()}
            >
              Copy
            </Button>
          </div>
        </div>
        <div className='space-y-2'>
          <Label>QR preview</Label>
          <div
            className='flex justify-center rounded border border-slate-200 bg-white p-4'
            aria-label={previewAriaLabel}
          >
            {isRenderingPreview ? (
              <p className='text-sm text-slate-500'>Rendering…</p>
            ) : previewDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL preview from canvas
              <img src={previewDataUrl} alt='' className='h-44 w-44' width={176} height={176} />
            ) : (
              <p className='text-sm text-slate-500'>{renderError || 'Preview unavailable'}</p>
            )}
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            disabled={!builtUrl}
            onClick={() => void downloadPng(512)}
          >
            Download PNG (512)
          </Button>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            disabled={!builtUrl}
            onClick={() => void downloadPng(1024)}
          >
            Download PNG (1024)
          </Button>
        </div>
      </div>
    </ConfirmDialog>
  );
}
