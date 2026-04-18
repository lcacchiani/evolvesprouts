'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { trackAdminAnalyticsEvent } from '@/lib/admin-analytics';
import { getPublicSiteBaseUrl } from '@/lib/config';
import { generateReferralQrPngDataUrl } from '@/lib/qr-code-image';
import {
  buildPublicReferralUrlWithSlug,
  MY_BEST_AUNTIE_REFERRAL_LOCALES,
  REFERRAL_LOCALE_DISPLAY_LABELS,
  type MyBestAuntieReferralLocale,
  type ReferralParamName,
} from '@/lib/referral-links';
import type { DiscountType } from '@/types/services';

export interface ReferralLinkQrDialogProps {
  open: boolean;
  onClose: () => void;
  discountCode: string;
  /** Public `services.slug` for deep link, or null for locale home. */
  serviceSlug: string | null;
  discountType: DiscountType;
}

export function ReferralLinkQrDialog({
  open,
  onClose,
  discountCode,
  serviceSlug,
  discountType,
}: ReferralLinkQrDialogProps) {
  const [locale, setLocale] = useState<MyBestAuntieReferralLocale>('en');
  const paramName: ReferralParamName = discountType === 'referral' ? 'ref' : 'discount';
  const [includeLogoInQr, setIncludeLogoInQr] = useState(true);
  const [applyBranding, setApplyBranding] = useState(true);
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [renderError, setRenderError] = useState('');

  const baseUrl = useMemo(() => getPublicSiteBaseUrl(), []);
  const builtUrl = useMemo(() => {
    if (!baseUrl) {
      return '';
    }
    return buildPublicReferralUrlWithSlug({
      baseUrl,
      locale,
      serviceSlug,
      code: discountCode,
      paramName,
    });
  }, [baseUrl, discountCode, locale, paramName, serviceSlug]);

  const analyticsSlugTag = serviceSlug?.trim().toLowerCase() || 'home';

  useEffect(() => {
    if (open) {
      trackAdminAnalyticsEvent('admin_referral_qr_opened', { service_slug: analyticsSlugTag });
    }
  }, [analyticsSlugTag, open]);

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
      const logoSrc = includeLogoInQr ? `${window.location.origin}/evolvesprouts-logo.svg` : '';
      void generateReferralQrPngDataUrl({
        url: builtUrl,
        size: 220,
        logoSrc,
        applyBranding,
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
  }, [applyBranding, builtUrl, includeLogoInQr, open]);

  async function downloadPng(size: number) {
    if (!builtUrl) {
      return;
    }
    const logoSrc = includeLogoInQr ? `${window.location.origin}/evolvesprouts-logo.svg` : '';
    const dataUrl = await generateReferralQrPngDataUrl({
      url: builtUrl,
      size,
      logoSrc,
      applyBranding,
    });
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${discountCode.trim().toUpperCase()}-${size}.png`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    trackAdminAnalyticsEvent('admin_referral_qr_downloaded', {
      service_slug: analyticsSlugTag,
      png_size_px: size,
    });
  }

  const configError = !baseUrl.trim()
    ? 'Set NEXT_PUBLIC_PUBLIC_SITE_BASE_URL to generate referral links.'
    : '';

  const previewAriaLabel = `QR code preview for referral link (${analyticsSlugTag})`;

  const destinationHint = serviceSlug?.trim()
    ? `Opens the public service page for “${serviceSlug.trim()}”.`
    : 'Opens the public site home for the selected locale.';

  return (
    <ConfirmDialog
      open={open}
      title='Link and QR'
      description={`Share this link or QR. ${destinationHint} Locale is included in the URL for consistent scanning.`}
      cancelLabel='Close'
      confirmLabel='Close'
      hideConfirm
      dialogRole='dialog'
      onCancel={onClose}
      onConfirm={onClose}
    >
      <div className='space-y-4' aria-label='Referral link configuration and preview'>
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
                  {REFERRAL_LOCALE_DISPLAY_LABELS[entry]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label aria-hidden='true' className='invisible mb-1 block select-none'>
              {' '}
            </Label>
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <input
                  id='referral-qr-include-logo'
                  type='checkbox'
                  className='h-4 w-4 rounded border-slate-300 text-slate-900'
                  checked={includeLogoInQr}
                  onChange={(event) => setIncludeLogoInQr(event.target.checked)}
                  disabled={Boolean(configError)}
                />
                <Label htmlFor='referral-qr-include-logo' className='mb-0 cursor-pointer font-normal'>
                  Include logo in QR code
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <input
                  id='referral-qr-apply-branding'
                  type='checkbox'
                  className='h-4 w-4 rounded border-slate-300 text-slate-900'
                  checked={applyBranding}
                  onChange={(event) => setApplyBranding(event.target.checked)}
                  disabled={Boolean(configError)}
                />
                <Label htmlFor='referral-qr-apply-branding' className='mb-0 cursor-pointer font-normal'>
                  Apply branding
                </Label>
              </div>
            </div>
          </div>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='referral-preview-url'>Preview URL</Label>
          {builtUrl ? (
            <a
              id='referral-preview-url'
              href={builtUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='block max-w-full break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950'
            >
              {builtUrl}
            </a>
          ) : (
            <p
              id='referral-preview-url'
              className='block max-w-full break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-500'
            >
              —
            </p>
          )}
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
